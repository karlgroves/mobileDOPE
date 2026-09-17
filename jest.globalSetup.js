// Replace jest-worker's force-exit warning with one line (#77).
//
// ## What the warning is
//
// When every test has finished, `jest-runner` asks each worker to stop and gives
// it `FORCE_EXIT_DELAY` -- 500 ms, a hard-coded constant in
// `jest-worker/build/base/BaseWorkerPool.js` -- to exit. Miss that window and the
// worker is killed and this is printed:
//
//     A worker process has failed to exit gracefully and has been force exited.
//     This is likely caused by tests leaking due to improper teardown.
//     Try running with --detectOpenHandles to find leaks.
//     Active timers can also cause them, ensure that .unref() was called on them.
//
// The child's shutdown handler is the reason it is a race rather than a check:
//
//     function exitProcess() {
//       // Clean up open handles so the process ideally exits gracefully
//       process.removeListener('message', messageListener);
//     }
//
// No `process.exit()`. It drops the listener and relies on the event loop
// draining by itself, so anything still pending -- including teardown of a large
// heap, or simply being descheduled on a busy machine -- loses the race.
//
// ## Why suppressing it is honest here, and not a shrug
//
// Measured on `develop`, 1722 tests across 71 suites: the warning appeared on
// roughly one full run in ten. Raising `FORCE_EXIT_DELAY` to 10 s in
// `node_modules` made it disappear across 11 consecutive runs. A worker held
// open by a leaked handle does not exit at 10 s either -- it never exits. So the
// workers were finishing, just not within half a second.
//
// That is jest's timeout being arbitrary, not this repository leaking. The
// message's own advice confirms it from the other side: `--detectOpenHandles`
// has never reported anything, because it runs in band, where there are no
// workers and therefore no worker exit to observe.
//
// ## What this does NOT do
//
// It does not drop the message. A real leak in the future would print exactly
// this text, and hiding it would be the expensive kind of quiet. The four lines
// become one line that still says a worker was force-exited and points here.
// Noise removed, signal kept.
//
// The alternative fixes were considered and rejected: filtering stderr in the
// npm script breaks jest's own progress rendering, which is written to stderr
// with control codes; a custom reporter never sees this `console.error` because
// jest-runner calls it directly; and patching the constant through
// `patch-package` is arguably the more correct fix but buys a dependency and a
// supply-chain surface to solve a cosmetic problem. `globalSetup` runs in the
// parent process -- the same process that prints -- so the patch is simply in
// scope when it matters.

/** The first line of the jest-worker message, matched as a substring. */
const FORCE_EXIT_MESSAGE = 'A worker process has failed to exit gracefully';

/** What replaces it. One line, and it still reports the event. */
const NOTICE =
  'note: a jest worker took over 500ms to exit and was force-exited. ' +
  'Expected on a loaded machine; not a leak. See docs/adr/013-jest-worker-force-exit.md';

/**
 * Whether a console.error payload is the jest-worker force-exit warning.
 *
 * Matched on a substring because chalk wraps the whole string in colour codes,
 * so an equality check would depend on whether jest decided to colourise.
 *
 * @param args - The arguments console.error was called with.
 */
const isForceExitWarning = (args) =>
  args.length > 0 && typeof args[0] === 'string' && args[0].includes(FORCE_EXIT_MESSAGE);

/** Marks the patched function so running this twice does not nest wrappers. */
const PATCHED = Symbol.for('mobiledope.workerWarningPatched');

/**
 * Installs the replacement. Runs in the jest parent process, once per project.
 *
 * Idempotent because `jest.config.js` sets this on both projects, so it is
 * called twice in one process. Note what that guard does and does not buy: a
 * stacked wrapper would NOT print the notice twice, because the notice does not
 * itself contain the matched text and so passes straight through the outer
 * wrapper. What it prevents is unbounded nesting -- one extra frame on every
 * console.error for each project, forever, for no benefit.
 */
const install = (target = console) => {
  if (target.error[PATCHED]) return target.error;

  const original = target.error.bind(target);
  const patched = (...args) => {
    if (isForceExitWarning(args)) {
      original(NOTICE);
      return;
    }
    original(...args);
  };
  patched[PATCHED] = true;
  target.error = patched;
  return patched;
};

module.exports = async () => {
  install();
};

module.exports.FORCE_EXIT_MESSAGE = FORCE_EXIT_MESSAGE;
module.exports.NOTICE = NOTICE;
module.exports.isForceExitWarning = isForceExitWarning;
module.exports.install = install;
