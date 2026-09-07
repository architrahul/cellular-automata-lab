# Cellular Automata Findings Notes

Use this file to collect report material while experimenting with the website.

## Simulator

The site implements a two-dimensional binary cellular automaton with a Moore neighborhood. Each cell has eight possible neighbors. Rules are represented as `B.../S...`, where the birth set applies to dead cells and the survival set applies to live cells.

## Initial experiments to run

- Conway's Life, `B3/S23`, at random densities around 10%, 20%, 30%, and 50%.
- HighLife, `B36/S23`, at the same densities.
- Randomly sampled outer-totalistic rules from the "Sample rule" button.
- Task 3 batch study: Conway's Life, HighLife, and 98 seeded random rules.

## Task 3 classification measurements

- Density: final live cells divided by total cells.
- Activity: changed cells divided by total cells.
- Occupied area: bounding-box area containing all live cells, divided by total cells.
- Periodicity: repeated whole-grid hashes, with period recorded when a prior state appears again.
- Mobility proxy: center-of-mass displacement over the run, stored as a tag when sustained moving activity is detected.

## Task 3 automatic classes

- Extinct: no live cells remain.
- Frozen: nonzero cells remain, but activity is approximately zero.
- Periodic: a whole-grid state repeats with period greater than one.
- Expanding: density or occupied area increases strongly over the run.
- Disordered: sustained high activity at high density.
- Structured Dynamic: persistent activity at lower density or in a more bounded occupied area.
- Bounded Dynamic: low but nonzero activity without clear extinction, freezing, periodicity, or expansion.

Mobile is treated as a tag rather than an exclusive class. Reproduction should still be checked visually because reliable automatic detection of self-copying structures is a much harder pattern-recognition problem than the core measurements.

## Observation template

- Rule:
- Grid size:
- Initial density:
- Edge wrapping:
- Generations observed:
- Behavior category: extinction, stability, oscillation, growth, disorder, mobility, or other.
- Interesting structures:
- Notes:

## AI usage notes

Codex helped translate the assignment requirements into a static HTML, CSS, and JavaScript simulator. It also added experiment logging so observations can be reused in the final report.

## Option B next steps

For the noise and perturbation extension, add a small probability that each cell flips after every simulation step. Useful experiments would compare whether stable patterns, moving structures, and oscillators survive under different noise values such as 0.1%, 0.5%, 1%, and 5%.
