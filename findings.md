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

## Option B perturbation model

For the noise and perturbation extension, the simulation adds a small probability that each cell flips after every simulation step. This lets the report compare whether stable patterns, moving structures, and oscillators survive under different noise values such as 0.1%, 0.5%, 1%, and 5%.

## Recorded 500 x 500 and noise sweep

The large-grid follow-up uses the same 100-rule set as the original Task 3 run, but increases the grid to 500 x 500. Each run lasts 500 generations with wrapped edges and 24% initial live density. The noise sweep then repeats each rule from the same starting grid at `p = 0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0`, where `p` is the probability that a cell flips after each rule update.

At 500 x 500 with no noise, 7 of the 100 rules changed dominant class relative to the earlier 100 x 100 study. Conway Life and HighLife both stayed Structured Dynamic.

Noise made 19 rules change class even at `p = 0.001`. The affected count rose gradually through the middle of the sweep and reached 54 changed rules at `p = 1.0`. Conway Life and HighLife stayed Structured Dynamic through `p = 0.05`, became Disordered at `p = 0.1`, and had degenerate high-noise behavior at `p = 1.0`.

The detailed tables are in `results/task3_500_noise_summary.md`, with raw trial data in the associated CSV files.
