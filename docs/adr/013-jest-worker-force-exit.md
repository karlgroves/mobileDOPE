# ADR-013: Replace jest-worker's force-exit warning rather than chase it

**Status:** Accepted

**Date:** 2026-09-17

## Context

`npm test` and `npm run test:coverage` intermittently print:

```text
A worker process has failed to exit gracefully and has been force exited.
This is likely caused by tests leaking due to improper teardown.
Try running with --detectOpenHandles to find leaks.
Active timers can also cause them, ensure that .unref() was called on them.
```

All suites pass. It is noise on a green run, which is exactly why it survived
from #54 through #58 and into #77 without anyone pinning it down.

It also cost real time. #77 was closed on 20 consecutive clean runs measured on a
branch carrying 1340 tests, and the warning reappeared on the first run against
`develop` at 1722 tests. The measurement was sound; what was wrong was treating a
property measured on a smaller tree as a property of the repository.

## What it actually is

Two pieces of `jest-worker` 29.7.0, read rather than inferred.

`jest-runner/build/index.js` prints the message when `worker.end()` reports that
a worker was force-exited. `jest-worker/build/base/BaseWorkerPool.js` decides
that:

```js
const FORCE_EXIT_DELAY = 500;
// ...
worker.send([CHILD_MESSAGE_END, false], ...);
const forceExitTimeout = setTimeout(() => {
  worker.forceExit();
  forceExited = true;
}, FORCE_EXIT_DELAY);
await worker.waitForExit();
```

So once every test has passed, each worker gets **500 ms** to exit. The child's
side of that handshake is the reason it is a race and not a check:

```js
function exitProcess() {
  // Clean up open handles so the process ideally exits gracefully
  process.removeListener('message', messageListener);
}
```

There is no `process.exit()`. The child drops its message listener and relies on
its event loop draining by itself. Anything still pending — teardown of a large
heap, a garbage collection, or simply being descheduled on a busy machine — loses
the race, and the worker is killed.

## Why this is not a leak in this repository

Measured on `develop` at 1722 tests across 71 suites:

| condition                                                         | runs | warning |
| ----------------------------------------------------------------- | ---- | ------- |
| `npm test`, unmodified                                            | ~10  | ~1      |
| `npm test`, `FORCE_EXIT_DELAY` raised to 10 s in `node_modules`   | 11   | 0       |
| `securitySecrets` alone (the only suite that spawns subprocesses) | 6    | 0       |
| four pure-ballistic-math suites alone                             | 10   | 0       |

The second row is the decisive one. **A worker held open by a leaked handle does
not exit at 10 s either — it never exits.** The workers were finishing; they were
just not finishing within half a second.

The rest of the evidence agrees, and no leak hypothesis explains it:

- `--detectOpenHandles` has never reported anything. It runs in band, where there
  are no worker processes and therefore no worker exit to observe. The message's
  own advice cannot see the thing the message is about.
- The warning never appears under `--runInBand`, for the same reason.
- It is not attributable to any suite. Any worker can lose a 500 ms race, so
  bisecting by suite was never going to converge — and did not, across three
  attempts in #54, #58 and #77.
- The rate scales with suite size. 27% more tests meant more workers with more
  heap to tear down.

## Decision

Replace the four-line warning with one line, in the jest parent process, via
`globalSetup`.

`jest.globalSetup.js` patches `console.error` to recognise exactly this message
and print instead:

```text
note: a jest worker took over 500ms to exit and was force-exited.
Expected on a loaded machine; not a leak. See docs/adr/013-jest-worker-force-exit.md
```

**It is replaced, not dropped.** A genuine leak in future would print the same
text, and hiding it outright would be the expensive kind of quiet. The event is
still reported; it is reported proportionately, and it points here.

### Alternatives considered

| option                              | why not                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filter stderr in the npm script     | jest writes its own progress display to stderr with terminal control codes. Piping it through a filter destroys that for every developer, to fix a cosmetic problem.                                                                                                                                                                                    |
| A custom reporter                   | Reporters never see this. `jest-runner` calls `console.error` directly, outside the reporter interface.                                                                                                                                                                                                                                                 |
| `patch-package` the 500 ms constant | Arguably the **most correct** fix: the message is accurate and the timeout is the arbitrary part; raising it would leave the warning meaningful for genuinely stuck workers. Rejected because it buys a dependency and a supply-chain surface to solve a cosmetic problem. Worth revisiting if the project acquires `patch-package` for another reason. |
| Leave it                            | This is what the previous three attempts did by default. A warning that prints on a passing run trains everyone to ignore warnings on passing runs, and this is the message that would have said so when something did start leaking.                                                                                                                   |

`globalSetup` runs in the parent process — the same process that prints — so the
patch is simply in scope when it matters. It is set on both jest projects,
because `globalSetup` is a per-project option, and is idempotent for that reason.

## Consequences

- The four-line message no longer appears. One line does, on roughly one run in
  ten, and it is accurate.
- `__tests__/unit/workerWarningSuppression.test.ts` holds the filter to its
  claims: it matches the real message colourised or plain, leaves every other
  `console.error` untouched with its arguments intact, still reports the event,
  points at a document that exists, and does not double-print when installed
  twice.
- **If this message starts appearing on every run, treat it as a real leak
  again.** The reasoning above rests on it being intermittent and on workers
  exiting given more time. A change in either invalidates this ADR rather than
  being covered by it.
- The upstream behaviour is outside this repository's control. If jest makes
  `FORCE_EXIT_DELAY` configurable, or calls `process.exit()` in the child, this
  can be deleted.

## Related

- #54 — first sighting; wrongly suspected as the cause of a coverage flake.
- #58 — fixed that coverage flake (a different cause) and deliberately left this.
- #77 — this issue. Closed once on a measurement taken against a smaller tree,
  reopened when it recurred, and resolved here.
