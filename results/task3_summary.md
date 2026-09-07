# Task 3 Rule Study Results

Generated: 2026-09-07T23:25:10.942Z

## Run Configuration

- Total rules: 100 (Conway Life, HighLife, and 98 seeded random outer-totalistic rules)
- Trials per rule: 10
- Steps per trial: 500
- Grid: 100 x 100
- Initial live-cell density: 24%
- Edge handling: wrapped torus
- Random seed: 202609
- Total trials: 1000
- Runtime: 43.9 seconds

## Dominant Rule Classes

- Extinct: 1 rules
- Frozen: 8 rules
- Periodic: 14 rules
- Expanding: 9 rules
- Disordered: 57 rules
- Structured Dynamic: 11 rules
- Bounded Dynamic: 0 rules

## Pinned Rules

| Rule label | Rule | Dominant class | Trial distribution | Avg final density | Avg late activity | Mobile tag |
| --- | --- | --- | --- | --- | --- | --- |
| Conway Life | B3/S23 | Structured Dynamic | Structured Dynamic: 100% | 0.053 | 0.037 | 0% |
| HighLife | B36/S23 | Structured Dynamic | Structured Dynamic: 100% | 0.043 | 0.032 | 0% |

## Structured Or Mobile Candidates

| Rule label | Rule | Dominant class | Trial distribution | Avg final density | Avg late activity | Mobile tag |
| --- | --- | --- | --- | --- | --- | --- |
| Conway Life | B3/S23 | Structured Dynamic | Structured Dynamic: 100% | 0.053 | 0.037 | 0% |
| HighLife | B36/S23 | Structured Dynamic | Structured Dynamic: 100% | 0.043 | 0.032 | 0% |
| Sample 05 | B045678/S678 | Structured Dynamic | Structured Dynamic: 100% | 0.284 | 0.476 | 0% |
| Sample 23 | B056/S1278 | Periodic | Periodic: 80% / Structured Dynamic: 20% | 0.269 | 0.034 | 0% |
| Sample 29 | B0568/S134 | Structured Dynamic | Structured Dynamic: 100% | 0.282 | 0.053 | 0% |
| Sample 38 | B267/S026 | Structured Dynamic | Structured Dynamic: 100% | 0.304 | 0.407 | 0% |
| Sample 42 | B047/S37 | Structured Dynamic | Structured Dynamic: 100% | 0.266 | 0.414 | 0% |
| Sample 49 | B2/S014678 | Structured Dynamic | Structured Dynamic: 100% | 0.317 | 0.374 | 0% |
| Sample 58 | B148/S0368 | Structured Dynamic | Structured Dynamic: 100% | 0.329 | 0.444 | 0% |
| Sample 74 | B047/S02378 | Structured Dynamic | Structured Dynamic: 100% | 0.298 | 0.253 | 0% |
| Sample 80 | B2568/S0156 | Structured Dynamic | Structured Dynamic: 100% | 0.340 | 0.473 | 0% |
| Sample 96 | B01567/S17 | Structured Dynamic | Structured Dynamic: 100% | 0.344 | 0.548 | 0% |

## Notes

The automatic classifier is measurement-based. Extinction, frozen states, and whole-grid periodicity are direct outcomes. Expanding, disordered, structured dynamic, bounded dynamic, and mobile are heuristic labels based on density, activity, occupied bounding-box area, area/density trends, and center-of-mass movement. Reproduction is not automatically assigned because reliable self-copy detection requires visual or pattern-level confirmation.
