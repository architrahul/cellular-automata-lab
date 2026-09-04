# Cellular Automata Lab

Interactive static website for the Emergent Complexity initial assignment. It starts with Conway's Game of Life and generalizes the simulator to editable binary outer-totalistic rules.

## What it does

- Draw live/dead cells directly on the grid.
- Run, pause, step, clear, and randomize the simulation.
- Adjust grid size, speed, random initial density, and edge wrapping.
- Edit birth and survival neighbor counts visually for rules like `B3/S23` and `B36/S23`.
- Sample random outer-totalistic rules and log observations for later report writing.
- Download observation logs as CSV.

## Running locally

Open `index.html` in a browser. No build step or package install is required.

If you prefer a local server:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages

This repo is designed to work as a plain GitHub Pages site from the repository root.

After pushing to GitHub:

1. Open the repository settings.
2. Go to Pages.
3. Choose the `main` branch and the repository root.
4. Save.

The site should then publish at `https://architrahul.github.io/<repository-name>/`.

## Assignment scope

Implemented now:

- Task 1: interactive Game of Life simulator.
- Task 2: editable outer-totalistic rule controls, including HighLife.
- Task 3 support: random rule sampling and observation logging.

Not implemented yet:

- Option B noise and perturbations. The current app leaves room to add per-step random flips, noise controls, and robustness comparisons later.

