# Cellular Automata Findings Notes

Use this file to collect report material while experimenting with the website.

## Simulator

The site implements a two-dimensional binary cellular automaton with a Moore neighborhood. Each cell has eight possible neighbors. Rules are represented as `B.../S...`, where the birth set applies to dead cells and the survival set applies to live cells.

## Initial experiments to run

- Conway's Life, `B3/S23`, at random densities around 10%, 20%, 30%, and 50%.
- HighLife, `B36/S23`, at the same densities.
- Randomly sampled outer-totalistic rules from the "Sample rule" button.

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

