#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const primaryClasses = [
  "Extinct",
  "Frozen",
  "Periodic",
  "Expanding",
  "Disordered",
  "Structured Dynamic",
  "Bounded Dynamic",
];

const config = {
  rules: 100,
  trials: 10,
  steps: 500,
  n: 100,
  density: 0.24,
  wrap: true,
  seed: 202609,
};

function masksFromCounts(birthCountsList, survivalCountsList) {
  return {
    birthMask: birthCountsList.reduce((mask, count) => mask | (1 << count), 0),
    survivalMask: survivalCountsList.reduce((mask, count) => mask | (1 << count), 0),
  };
}

function ruleStringFromMasks(birthMask, survivalMask) {
  const birth = [];
  const survival = [];

  for (let count = 0; count <= 8; count += 1) {
    if (birthMask & (1 << count)) birth.push(count);
    if (survivalMask & (1 << count)) survival.push(count);
  }

  return `B${birth.join("")}/S${survival.join("")}`;
}

function ruleCode(birthMask, survivalMask) {
  return birthMask | (survivalMask << 9);
}

function makeRng(seed) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 1;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeStudyRules(rng) {
  const life = masksFromCounts([3], [2, 3]);
  const highlife = masksFromCounts([3, 6], [2, 3]);
  const rules = [
    { label: "Conway Life", ...life },
    { label: "HighLife", ...highlife },
  ];
  const seen = new Set(rules.map((rule) => ruleCode(rule.birthMask, rule.survivalMask)));

  while (rules.length < config.rules) {
    let birthMask = 0;
    let survivalMask = 0;

    for (let count = 0; count <= 8; count += 1) {
      if (rng() < 0.5) birthMask |= 1 << count;
      if (rng() < 0.5) survivalMask |= 1 << count;
    }

    const code = ruleCode(birthMask, survivalMask);
    if (seen.has(code)) continue;

    seen.add(code);
    rules.push({
      label: `Sample ${String(rules.length - 1).padStart(2, "0")}`,
      birthMask,
      survivalMask,
    });
  }

  return rules;
}

function hashState(state) {
  let hash = 2166136261;
  for (let i = 0; i < state.length; i += 1) {
    hash ^= state[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomStudyState(n, density, rng) {
  const state = new Uint8Array(n * n);
  for (let i = 0; i < state.length; i += 1) {
    state[i] = rng() < density ? 1 : 0;
  }
  return state;
}

function countLiveState(state) {
  let live = 0;
  for (let i = 0; i < state.length; i += 1) live += state[i];
  return live;
}

function stepWrapped(state, nextState, n, birthMask, survivalMask) {
  let live = 0;
  let changes = 0;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let hash = 2166136261;

  for (let y = 0; y < n; y += 1) {
    const row = y * n;
    const up = (y === 0 ? n - 1 : y - 1) * n;
    const down = (y === n - 1 ? 0 : y + 1) * n;

    for (let x = 0; x < n; x += 1) {
      const left = x === 0 ? n - 1 : x - 1;
      const right = x === n - 1 ? 0 : x + 1;
      const i = row + x;
      const neighbors =
        state[up + left] +
        state[up + x] +
        state[up + right] +
        state[row + left] +
        state[row + right] +
        state[down + left] +
        state[down + x] +
        state[down + right];
      const alive = state[i] === 1;
      const value = alive
        ? (survivalMask & (1 << neighbors)) !== 0
        : (birthMask & (1 << neighbors)) !== 0;
      const nextValue = value ? 1 : 0;

      nextState[i] = nextValue;
      hash ^= nextValue;
      hash = Math.imul(hash, 16777619);

      if (nextValue !== state[i]) changes += 1;

      if (value) {
        live += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumY += y;
      }
    }
  }

  return {
    live,
    changes,
    hash: hash >>> 0,
    bboxArea: live === 0 ? 0 : (maxX - minX + 1) * (maxY - minY + 1),
    centerX: live === 0 ? null : sumX / live,
    centerY: live === 0 ? null : sumY / live,
  };
}

function emptyAccumulator() {
  return {
    count: 0,
    density: 0,
    activity: 0,
    area: 0,
    centerX: 0,
    centerY: 0,
    centerCount: 0,
  };
}

function addMetric(acc, stats, totalCells) {
  acc.count += 1;
  acc.density += stats.live / totalCells;
  acc.activity += stats.changes / totalCells;
  acc.area += stats.bboxArea / totalCells;

  if (stats.centerX !== null && stats.centerY !== null) {
    acc.centerX += stats.centerX;
    acc.centerY += stats.centerY;
    acc.centerCount += 1;
  }
}

function averageMetric(acc, key) {
  return acc.count === 0 ? 0 : acc[key] / acc.count;
}

function averageCenter(acc, key) {
  return acc.centerCount === 0 ? null : acc[key] / acc.centerCount;
}

function classifyRun(finalStats, repeat, early, late, n, totalCells) {
  const finalDensity = finalStats.live / totalCells;
  const finalActivity = finalStats.changes / totalCells;
  const avgEarlyDensity = averageMetric(early, "density");
  const avgLastDensity = averageMetric(late, "density");
  const avgLastActivity = averageMetric(late, "activity");
  const avgEarlyArea = averageMetric(early, "area");
  const avgLastArea = averageMetric(late, "area");
  const densityTrend = avgLastDensity - avgEarlyDensity;
  const areaTrend = avgLastArea - avgEarlyArea;
  const earlyCenterX = averageCenter(early, "centerX");
  const earlyCenterY = averageCenter(early, "centerY");
  const lateCenterX = averageCenter(late, "centerX");
  const lateCenterY = averageCenter(late, "centerY");
  let primaryClass = "Bounded Dynamic";

  if (finalStats.live === 0) {
    primaryClass = "Extinct";
  } else if (finalActivity <= 1 / totalCells || repeat?.period === 1) {
    primaryClass = "Frozen";
  } else if (repeat && repeat.period > 1) {
    primaryClass = "Periodic";
  } else if (areaTrend > 0.12 || densityTrend > 0.08 || (avgLastDensity > 0.65 && avgLastActivity > 0.08)) {
    primaryClass = "Expanding";
  } else if (avgLastActivity > 0.12 && avgLastDensity > 0.35) {
    primaryClass = "Disordered";
  } else if (avgLastActivity > 0.01) {
    primaryClass = avgLastArea < 0.65 || avgLastDensity < 0.35 ? "Structured Dynamic" : "Disordered";
  }

  const centerShift =
    earlyCenterX === null || earlyCenterY === null || lateCenterX === null || lateCenterY === null
      ? 0
      : Math.hypot(lateCenterX - earlyCenterX, lateCenterY - earlyCenterY) / n;
  const tags = [];

  if (centerShift > 0.12 && avgLastActivity > 0.005 && avgLastArea < 0.65) {
    tags.push("Mobile");
  }

  return {
    primaryClass,
    finalDensity,
    finalActivity,
    avgLastDensity,
    avgLastActivity,
    avgLastArea,
    densityTrend,
    areaTrend,
    repeatPeriod: repeat?.period ?? 0,
    centerShift,
    tags,
  };
}

function runTrial(rule, trial, options, rng) {
  let state = randomStudyState(options.n, options.density, rng);
  let nextState = new Uint8Array(options.n * options.n);
  const totalCells = options.n * options.n;
  const seen = new Map();
  const windowSize = Math.max(20, Math.floor(options.steps * 0.2));
  const early = emptyAccumulator();
  const late = emptyAccumulator();
  let repeat = null;
  let finalStats = {
    live: countLiveState(state),
    changes: 0,
    hash: hashState(state),
    bboxArea: 0,
    centerX: null,
    centerY: null,
  };

  seen.set(`${finalStats.hash}:${finalStats.live}`, 0);

  for (let step = 1; step <= options.steps; step += 1) {
    finalStats = stepWrapped(state, nextState, options.n, rule.birthMask, rule.survivalMask);
    [state, nextState] = [nextState, state];

    if (step <= windowSize) addMetric(early, finalStats, totalCells);
    if (step > options.steps - windowSize) addMetric(late, finalStats, totalCells);

    const key = `${finalStats.hash}:${finalStats.live}`;
    if (!repeat && seen.has(key)) {
      repeat = { firstStep: seen.get(key), step, period: step - seen.get(key) };
    } else if (!repeat) {
      seen.set(key, step);
    }
  }

  const classification = classifyRun(finalStats, repeat, early, late, options.n, totalCells);

  return {
    ruleLabel: rule.label,
    rule: ruleStringFromMasks(rule.birthMask, rule.survivalMask),
    trial,
    steps: options.steps,
    gridSize: options.n,
    initialDensity: options.density,
    wrap: options.wrap,
    finalLive: finalStats.live,
    finalBoundingBoxArea: finalStats.bboxArea,
    ...classification,
  };
}

function aggregateRule(rule, runs) {
  const counts = Object.fromEntries(primaryClasses.map((className) => [className, 0]));
  let avgFinalDensity = 0;
  let avgLastActivity = 0;
  let avgLastArea = 0;
  let avgDensityTrend = 0;
  let avgAreaTrend = 0;
  let avgCenterShift = 0;
  let mobileCount = 0;

  runs.forEach((run) => {
    counts[run.primaryClass] += 1;
    avgFinalDensity += run.finalDensity;
    avgLastActivity += run.avgLastActivity;
    avgLastArea += run.avgLastArea;
    avgDensityTrend += run.densityTrend;
    avgAreaTrend += run.areaTrend;
    avgCenterShift += run.centerShift;
    if (run.tags.includes("Mobile")) mobileCount += 1;
  });

  const dominantClass = primaryClasses.reduce((best, className) =>
    counts[className] > counts[best] ? className : best
  );
  const trialCount = runs.length || 1;
  const distribution = primaryClasses
    .filter((className) => counts[className] > 0)
    .map((className) => `${className}: ${Math.round((counts[className] / trialCount) * 100)}%`)
    .join(" / ");

  return {
    label: rule.label,
    rule: ruleStringFromMasks(rule.birthMask, rule.survivalMask),
    dominantClass,
    distribution,
    extinctPct: counts.Extinct / trialCount,
    frozenPct: counts.Frozen / trialCount,
    periodicPct: counts.Periodic / trialCount,
    expandingPct: counts.Expanding / trialCount,
    disorderedPct: counts.Disordered / trialCount,
    structuredPct: counts["Structured Dynamic"] / trialCount,
    boundedPct: counts["Bounded Dynamic"] / trialCount,
    avgFinalDensity: avgFinalDensity / trialCount,
    avgLastActivity: avgLastActivity / trialCount,
    avgLastArea: avgLastArea / trialCount,
    avgDensityTrend: avgDensityTrend / trialCount,
    avgAreaTrend: avgAreaTrend / trialCount,
    avgCenterShift: avgCenterShift / trialCount,
    mobilePct: mobileCount / trialCount,
  };
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function writeCsv(filePath, header, rows) {
  const lines = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvEscape(row[key] ?? "")).join(",")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function fixed(value, digits = 4) {
  return Number(value).toFixed(digits);
}

function writeSummaryMarkdown(filePath, summaryRows, trialRows, elapsedMs) {
  const classCounts = Object.fromEntries(primaryClasses.map((className) => [className, 0]));
  summaryRows.forEach((row) => {
    classCounts[row.dominantClass] += 1;
  });

  const highlighted = summaryRows
    .filter((row) => ["Conway Life", "HighLife"].includes(row.label))
    .map(
      (row) =>
        `| ${row.label} | ${row.rule} | ${row.dominantClass} | ${row.distribution} | ${fixed(row.avgFinalDensity, 3)} | ${fixed(row.avgLastActivity, 3)} | ${pct(row.mobilePct)} |`
    )
    .join("\n");

  const topStructured = summaryRows
    .filter((row) => row.structuredPct > 0 || row.mobilePct > 0)
    .slice(0, 12)
    .map(
      (row) =>
        `| ${row.label} | ${row.rule} | ${row.dominantClass} | ${row.distribution} | ${fixed(row.avgFinalDensity, 3)} | ${fixed(row.avgLastActivity, 3)} | ${pct(row.mobilePct)} |`
    )
    .join("\n");

  const classList = primaryClasses
    .map((className) => `- ${className}: ${classCounts[className]} rules`)
    .join("\n");

  const markdown = `# Task 3 Rule Study Results

Generated: ${new Date().toISOString()}

## Run Configuration

- Total rules: ${config.rules} (Conway Life, HighLife, and ${config.rules - 2} seeded random outer-totalistic rules)
- Trials per rule: ${config.trials}
- Steps per trial: ${config.steps}
- Grid: ${config.n} x ${config.n}
- Initial live-cell density: ${pct(config.density)}
- Edge handling: ${config.wrap ? "wrapped torus" : "bounded edges"}
- Random seed: ${config.seed}
- Total trials: ${trialRows.length}
- Runtime: ${(elapsedMs / 1000).toFixed(1)} seconds

## Dominant Rule Classes

${classList}

## Pinned Rules

| Rule label | Rule | Dominant class | Trial distribution | Avg final density | Avg late activity | Mobile tag |
| --- | --- | --- | --- | --- | --- | --- |
${highlighted}

## Structured Or Mobile Candidates

| Rule label | Rule | Dominant class | Trial distribution | Avg final density | Avg late activity | Mobile tag |
| --- | --- | --- | --- | --- | --- | --- |
${topStructured || "| None | - | - | - | - | - | - |"}

## Notes

The automatic classifier is measurement-based. Extinction, frozen states, and whole-grid periodicity are direct outcomes. Expanding, disordered, structured dynamic, bounded dynamic, and mobile are heuristic labels based on density, activity, occupied bounding-box area, area/density trends, and center-of-mass movement. Reproduction is not automatically assigned because reliable self-copy detection requires visual or pattern-level confirmation.
`;

  fs.writeFileSync(filePath, markdown);
}

function main() {
  const start = Date.now();
  const rng = makeRng(config.seed);
  const rules = makeStudyRules(rng);
  const summaryRows = [];
  const trialRows = [];

  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
    const rule = rules[ruleIndex];
    const runs = [];

    for (let trial = 1; trial <= config.trials; trial += 1) {
      const row = runTrial(rule, trial, config, rng);
      runs.push(row);
      trialRows.push(row);
    }

    summaryRows.push(aggregateRule(rule, runs));

    if ((ruleIndex + 1) % 10 === 0 || ruleIndex < 2) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Completed ${ruleIndex + 1}/${rules.length} rules in ${elapsed}s`);
    }
  }

  const resultsDir = path.join(process.cwd(), "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const trialHeader = [
    "ruleLabel",
    "rule",
    "trial",
    "primaryClass",
    "tags",
    "steps",
    "gridSize",
    "initialDensity",
    "wrap",
    "finalLive",
    "finalDensity",
    "finalActivity",
    "avgLastDensity",
    "avgLastActivity",
    "finalBoundingBoxArea",
    "avgLastArea",
    "densityTrend",
    "areaTrend",
    "repeatPeriod",
    "centerShift",
  ];
  const summaryHeader = [
    "label",
    "rule",
    "dominantClass",
    "distribution",
    "extinctPct",
    "frozenPct",
    "periodicPct",
    "expandingPct",
    "disorderedPct",
    "structuredPct",
    "boundedPct",
    "avgFinalDensity",
    "avgLastActivity",
    "avgLastArea",
    "avgDensityTrend",
    "avgAreaTrend",
    "avgCenterShift",
    "mobilePct",
  ];

  const csvTrialRows = trialRows.map((row) => ({
    ...row,
    tags: row.tags.join("|"),
    initialDensity: fixed(row.initialDensity, 3),
    finalDensity: fixed(row.finalDensity, 6),
    finalActivity: fixed(row.finalActivity, 6),
    avgLastDensity: fixed(row.avgLastDensity, 6),
    avgLastActivity: fixed(row.avgLastActivity, 6),
    avgLastArea: fixed(row.avgLastArea, 6),
    densityTrend: fixed(row.densityTrend, 6),
    areaTrend: fixed(row.areaTrend, 6),
    centerShift: fixed(row.centerShift, 6),
  }));
  const csvSummaryRows = summaryRows.map((row) => ({
    ...row,
    extinctPct: fixed(row.extinctPct, 3),
    frozenPct: fixed(row.frozenPct, 3),
    periodicPct: fixed(row.periodicPct, 3),
    expandingPct: fixed(row.expandingPct, 3),
    disorderedPct: fixed(row.disorderedPct, 3),
    structuredPct: fixed(row.structuredPct, 3),
    boundedPct: fixed(row.boundedPct, 3),
    avgFinalDensity: fixed(row.avgFinalDensity, 6),
    avgLastActivity: fixed(row.avgLastActivity, 6),
    avgLastArea: fixed(row.avgLastArea, 6),
    avgDensityTrend: fixed(row.avgDensityTrend, 6),
    avgAreaTrend: fixed(row.avgAreaTrend, 6),
    avgCenterShift: fixed(row.avgCenterShift, 6),
    mobilePct: fixed(row.mobilePct, 3),
  }));

  writeCsv(path.join(resultsDir, "task3_trials.csv"), trialHeader, csvTrialRows);
  writeCsv(path.join(resultsDir, "task3_rule_summary.csv"), summaryHeader, csvSummaryRows);
  writeSummaryMarkdown(path.join(resultsDir, "task3_summary.md"), summaryRows, trialRows, Date.now() - start);

  console.log(`Wrote ${path.join("results", "task3_trials.csv")}`);
  console.log(`Wrote ${path.join("results", "task3_rule_summary.csv")}`);
  console.log(`Wrote ${path.join("results", "task3_summary.md")}`);
}

main();
