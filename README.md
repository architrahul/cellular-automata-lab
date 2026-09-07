# Cellular Automata Lab

Interactive static website for the Emergent Complexity initial assignment. It starts with Conway's Game of Life and generalizes the simulator to editable binary outer-totalistic rules.

## What it does

- Draw live/dead cells directly on the grid.
- Run, pause, step, clear, and randomize the simulation.
- Adjust grid size, speed, random initial density, and edge wrapping.
- Choose grid sizes of 50 x 50, 100 x 100, 200 x 200, or 300 x 300. The default is 100 x 100.
- Edit birth and survival neighbor counts with checkboxes for rules like `B3/S23` and `B36/S23`.
- Sample random outer-totalistic rules and log observations for later report writing.
- Run a Task 3 study with Conway's Life, HighLife, and 98 random rules.
- Measure density, activity, occupied bounding-box area, hash-based periodicity, and center-of-mass movement.
- Classify each rule by its distribution across repeated random initial conditions.
- Download observation logs as CSV.

## Running locally

Open `index.html` in a browser. No build step or package install is required.

If you prefer a local server:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Running the Task 3 study

The recorded headless simulation can be rerun with:

```sh
node scripts/run_task3_study.js
```

This writes:

- `results/task3_summary.md`
- `results/task3_rule_summary.csv`
- `results/task3_trials.csv`

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
- Task 3 support: 100-rule batch study, random initial conditions, quantitative measurements, automatic classification, and CSV export.
- Task 3 recorded results: 100 rules, 10 trials per rule, 500 steps per trial, 100 x 100 grid, 24% starting density, wrapped edges, seed `202609`.

Not implemented yet:

- Option B noise and perturbations. The current app leaves room to add per-step random flips, noise controls, and robustness comparisons later.
