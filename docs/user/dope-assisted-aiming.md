# Understanding DOPE-assisted aiming

**Calculator** tab, under the solution. **Settings → DOPE-Assisted Aiming** for
the controls.

A solver works from published figures and an assumed atmosphere. Your logged
DOPE contains your barrel's real velocity, your scope's real tracking and your
load's real behaviour. DOPE-assisted aiming puts the second to work on the
first: it finds the logs that resemble the shot in front of you, measures how
wrong the solver was for those shots, and corrects today's figure by what it
finds.

The solver's own number stays on screen the whole time. Nothing here ever hides
it from you.

## What it actually does

1. **Finds the logs that resemble this shot.** Same rifle, same load, and a
   distance within the **matching window** — 50 yards by default, so a shot at
   600 is informed by logs from 550 to 650.
2. **Scores each one for relevance.** Distance similarity matters most, then how
   close the conditions were, then how recently it was shot and how well the
   group was recorded. A log at the edge of the window counts for far less than
   one at the exact distance.
3. **Measures the solver's error, log by log.** For each log it asks the solver
   what it would have predicted _in that log's own conditions_, and subtracts
   that from what you actually dialled. The difference is the correction.
4. **Combines them, weighted by relevance, and damps the result.** One log moves
   the figure less than six agreeing logs. The solver always keeps a share.
5. **Decides whether to say anything.** Below the **confidence threshold** it
   shows the solver alone and tells you why.

### Why there is no separate "altitude adjustment" step

A common design asks for the density altitude then and now, computes the
difference, and shifts the logged elevation by it. This app does not need that
step, because every correction is measured against the solver **in the air that
log was shot in**. A log from a thin mountain morning and one from dense
sea-level air both reduce to "how much the solver was wrong for me", and that is
the quantity worth carrying forward. The air is already in the prediction.

## Windage works differently, and has to

Elevation corrections can be averaged directly. Windage cannot. A log shot in
4 mph of crosswind and one shot in 15 say the same thing about your rifle and
quite different things about your turret.

So windage corrections are divided by the crosswind each log was shot in,
averaged as a figure **per mph of crosswind**, and then scaled back up to
today's wind.

Two consequences worth knowing:

- **Logs shot in no crosswind are left out of the windage correction.** Dead
  air, or wind at 12 or 6 o'clock, says nothing about wind. Those logs still
  count fully towards elevation.
- **With no crosswind today there is nothing to scale, so you get the solver's
  windage.** The screen says so rather than leaving you to wonder.

## Confidence, and what it is not

The percentage beside the recommendation is confidence in **the
recommendation**, not in any one log. It combines four things:

| Factor    | Asks                                                      |
| --------- | --------------------------------------------------------- |
| Evidence  | How much relevance-weight contributed                     |
| Quality   | How well evidenced those logs are in themselves           |
| Agreement | How closely their corrections agree with each other       |
| Proximity | How near the nearest of them was shot to today's distance |

That last pair is why six immaculately recorded logs can still produce a low
figure. If they disagree with each other, the honest answer is that your DOPE
does not yet know this load at this distance — and the app says that instead of
averaging the disagreement into a confident-looking number.

Confidence is a _separate_ figure from the per-log confidence shown against each
entry in the relevant-DOPE list. That one scores one observation; this one
scores the conclusion drawn from several.

## When to trust your DOPE over the solver

Broadly: **the further out, the more the log wins.**

- **Inside about 300 yards** the solver is usually close enough that the
  correction is small and the logs are arguing about very little.
- **Past 500 yards** a muzzle-velocity error of 30 fps or a BC that is 3%
  optimistic is worth real elevation, and your logs are the only thing that
  knows about it. This is where the feature earns its place.
- **Beyond your furthest logged distance** the figure is extrapolated. The app
  says so, and you should confirm with a sighter rather than dialling it on a
  cold target.

Some specific reasons to prefer the solver for a shot:

- You have changed something — a new lot of ammunition, a re-torqued scope, a
  cleaned barrel, a different suppressor. Your logs describe the old
  configuration, and nothing in the app can know that.
- The conditions are far outside anything you have logged. The ranking tells you
  how similar the conditions were; if that factor is weak, lean on the solver.
- The recommendation has low confidence. It will tell you, and it will say which
  factor was thin.

## Cold bore and heat shift

Two things the solver cannot model and only your own history can measure.

- **Cold-bore bias** is how far the first shot from a cold barrel departs from
  the warm ones. In the field the first shot is often the only shot, so this is
  the more useful of the two.
- **Heat shift** is how far your point of impact walks as a string heats the
  barrel, expressed as a change per shot.

Both are measured from corrections against the solver rather than from raw
dialled elevations — which is what lets shots taken at 300 and 900 yards be
combined at all.

Both refuse to answer on thin evidence. A cold-bore bias needs at least three
logged cold-bore shots and three warm ones (shots 2–5 of a string); a heat shift
needs at least six logged shots with a shot number recorded, at three or more
different positions in the string. Below those it shows no figure — it says which half
is short and what would answer it — rather than a number built from one group's
luck. Neither correction is dialled unless you turn it on for the shot.

For either to work, your logs have to record barrel state. The **New DOPE Log**
screen suggests cold bore when the rifle has not fired for ten minutes, and you
can change it — it is never assumed silently.

## The settings

**Settings → DOPE-Assisted Aiming.** Each has a plain-words description on the
screen; this is what they are for.

| Setting              | Default  | What it changes                                                                              |
| -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Adjust by My DOPE    | On       | Where the switch starts, in the calculator and in a range session. Off gives you the solver. |
| Matching Window      | 50 yards | How far from the shot a log can have been fired and still count. 25–100.                     |
| Confidence Threshold | 40%      | How much the app has to believe its own recommendation before using it.                      |
| Cold-Bore Modelling  | On       | Whether a range session measures and offers a cold-bore shift.                               |
| Heat-Shift Modelling | On       | Whether a range session measures and offers a heat shift.                                    |

**Reset** puts those five back and changes nothing else — not your theme, your
units, your custom calibers or your barometer calibration.

### Choosing a matching window

Wider is not better. Widening it finds more logs, but relevance falls off with
distance inside the window as well as outside it, so the extra logs arrive with
small weights and mostly dilute the ones that mattered. Reach for a wider window
when your logged distances are sparse — if you have logs at 400 and 600 and
nothing between, a 100-yard window lets both inform a shot at 500.

When nothing is close enough to match at all, the app interpolates the
correction across the distances you _have_ logged, and lowers the confidence the
further the shot is from the nearest of them.

### Choosing a confidence threshold

The default of 40% is deliberately permissive: it lets thin-but-real evidence
through while still refusing when your logs flatly disagree. Raise it if you
would rather be told less often and trust it more when you are told. Lower it if
you want the app to use whatever it has. At 0, any single log moves the figure.

## Where to see the working

On the solution screen, the **Your logged DOPE** card shows:

- the solver's own elevation, and the correction applied to it
- the same for windage, with the wind it was scaled from
- the confidence, and which factors were weak
- every contributing log, with its distance, its age and its own confidence

If the figure was interpolated rather than matched, it says so. If it was held
past your furthest logged distance, it says that too.

## What it does not do

- It does not know about anything you have changed and not logged.
- It does not blend raw logged elevations. The solver supplies the shape of the
  trajectory; only the correction is read from your logs.
- It does not learn from a shot until you log it. Firing a round in a range
  session increments the shot count; it is the logged DOPE entry that changes
  the next recommendation.
- It is not a substitute for a sighter at a distance you have never shot.

## See also

- **[Logging DOPE](./logging-dope.md)** — getting the entries this works from
- **[The ballistic calculator](./ballistic-calculator.md)** — what the solver
  itself models, and what it does not
