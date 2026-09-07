const canvas = document.querySelector("#automataCanvas");
const ctx = canvas.getContext("2d");

const runToggle = document.querySelector("#runToggle");
const stepButton = document.querySelector("#stepButton");
const randomButton = document.querySelector("#randomButton");
const clearButton = document.querySelector("#clearButton");
const gridSize = document.querySelector("#gridSize");
const speedRange = document.querySelector("#speedRange");
const speedLabel = document.querySelector("#speedLabel");
const densityRange = document.querySelector("#densityRange");
const randomDensityLabel = document.querySelector("#randomDensityLabel");
const wrapToggle = document.querySelector("#wrapToggle");
const gridSizeLabel = document.querySelector("#gridSizeLabel");
const ruleDisplay = document.querySelector("#ruleDisplay");
const generationStat = document.querySelector("#generationStat");
const liveStat = document.querySelector("#liveStat");
const densityStat = document.querySelector("#densityStat");
const activityStat = document.querySelector("#activityStat");
const birthCounts = document.querySelector("#birthCounts");
const survivalCounts = document.querySelector("#survivalCounts");
const sampleRuleButton = document.querySelector("#sampleRuleButton");
const logButton = document.querySelector("#logButton");
const downloadButton = document.querySelector("#downloadButton");
const observationText = document.querySelector("#observationText");
const logTable = document.querySelector("#logTable");
const studyStatus = document.querySelector("#studyStatus");
const studyGridSize = document.querySelector("#studyGridSize");
const studySteps = document.querySelector("#studySteps");
const studyTrials = document.querySelector("#studyTrials");
const studyDensity = document.querySelector("#studyDensity");
const studySeed = document.querySelector("#studySeed");
const runStudyButton = document.querySelector("#runStudyButton");
const cancelStudyButton = document.querySelector("#cancelStudyButton");
const downloadStudyButton = document.querySelector("#downloadStudyButton");
const studyProgress = document.querySelector("#studyProgress");
const studyRulesStat = document.querySelector("#studyRulesStat");
const studyTrialsStat = document.querySelector("#studyTrialsStat");
const studyTopClassStat = document.querySelector("#studyTopClassStat");
const studyTable = document.querySelector("#studyTable");

const presets = {
  life: { birth: [3], survival: [2, 3] },
  highlife: { birth: [3, 6], survival: [2, 3] },
  seeds: { birth: [2], survival: [] },
  daynight: { birth: [3, 6, 7, 8], survival: [3, 4, 6, 7, 8] },
};

let size = Math.min(Number(gridSize.value), 300);
let cells = new Uint8Array(size * size);
let next = new Uint8Array(size * size);
let generation = 0;
let running = false;
let lastFrame = 0;
let liveCells = 0;
let births = 0;
let deaths = 0;
let observations = [];
let studyResults = [];
let studyTrialRows = [];
let studyCancelled = false;
let birthRule = new Set(presets.life.birth);
let survivalRule = new Set(presets.life.survival);

const primaryClasses = [
  "Extinct",
  "Frozen",
  "Periodic",
  "Expanding",
  "Disordered",
  "Structured Dynamic",
  "Bounded Dynamic",
];

function indexFor(x, y) {
  return y * size + x;
}

function countNeighbors(x, y) {
  let count = 0;
  const wrap = wrapToggle.checked;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;

      let nx = x + dx;
      let ny = y + dy;

      if (wrap) {
        nx = (nx + size) % size;
        ny = (ny + size) % size;
      } else if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
        continue;
      }

      count += cells[indexFor(nx, ny)];
    }
  }

  return count;
}

function stepSimulation() {
  births = 0;
  deaths = 0;
  let live = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = indexFor(x, y);
      const alive = cells[i] === 1;
      const neighbors = countNeighbors(x, y);
      const survives = alive && survivalRule.has(neighbors);
      const born = !alive && birthRule.has(neighbors);
      const value = survives || born ? 1 : 0;

      next[i] = value;
      live += value;
      if (!alive && value) births += 1;
      if (alive && !value) deaths += 1;
    }
  }

  [cells, next] = [next, cells];
  generation += 1;
  liveCells = live;
  draw();
  updateStats();
}

function draw() {
  const width = canvas.width;
  const cellSize = width / size;

  ctx.clearRect(0, 0, width, width);
  ctx.fillStyle = "#eef3ed";
  ctx.fillRect(0, 0, width, width);

  ctx.fillStyle = "#15221f";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (cells[indexFor(x, y)] === 1) {
        ctx.fillRect(
          Math.floor(x * cellSize),
          Math.floor(y * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }

  if (cellSize >= 8) {
    ctx.strokeStyle = "rgba(101, 113, 116, 0.18)";
    ctx.lineWidth = 1;
    for (let line = 0; line <= size; line += 1) {
      const pos = Math.round(line * cellSize) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, width);
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }
  }
}

function updateStats() {
  const total = size * size;
  const density = total === 0 ? 0 : (liveCells / total) * 100;
  const changes = births + deaths;
  const activity =
    generation === 0
      ? "Idle"
      : changes === 0
        ? "Stable"
        : `${changes} changes`;

  generationStat.textContent = generation.toLocaleString();
  liveStat.textContent = liveCells.toLocaleString();
  densityStat.textContent = `${density.toFixed(1)}%`;
  activityStat.textContent = activity;
}

function refreshLiveCount() {
  liveCells = cells.reduce((sum, value) => sum + value, 0);
  updateStats();
}

function setRunning(value) {
  running = value;
  runToggle.textContent = running ? "Pause" : "Run";
  runToggle.classList.toggle("running", running);
  if (running) {
    lastFrame = performance.now();
    requestAnimationFrame(tick);
  }
}

function tick(now) {
  if (!running) return;

  const targetMs = 1000 / Number(speedRange.value);
  if (now - lastFrame >= targetMs) {
    stepSimulation();
    lastFrame = now;
  }

  requestAnimationFrame(tick);
}

function randomizeGrid() {
  const density = Number(densityRange.value) / 100;
  for (let i = 0; i < cells.length; i += 1) {
    cells[i] = Math.random() < density ? 1 : 0;
  }
  generation = 0;
  births = 0;
  deaths = 0;
  refreshLiveCount();
  draw();
}

function clearGrid() {
  cells.fill(0);
  generation = 0;
  births = 0;
  deaths = 0;
  refreshLiveCount();
  draw();
}

function resizeGrid(newSize) {
  setRunning(false);
  size = newSize;
  cells = new Uint8Array(size * size);
  next = new Uint8Array(size * size);
  gridSizeLabel.textContent = `${size} x ${size}`;
  clearGrid();
}

function ruleString() {
  const birth = [...birthRule].sort((a, b) => a - b).join("");
  const survival = [...survivalRule].sort((a, b) => a - b).join("");
  return `B${birth}/S${survival}`;
}

function syncRuleControls() {
  document.querySelectorAll("[data-rule-kind]").forEach((input) => {
    const count = Number(input.dataset.count);
    const rule = input.dataset.ruleKind === "birth" ? birthRule : survivalRule;
    const active = rule.has(count);
    input.checked = active;
    input.closest(".count-toggle").classList.toggle("active", active);
  });
  ruleDisplay.textContent = ruleString();
}

function setRule(birth, survival) {
  birthRule = new Set(birth);
  survivalRule = new Set(survival);
  syncRuleControls();
}

function makeRuleCheckboxes(container, kind) {
  for (let count = 0; count <= 8; count += 1) {
    const label = document.createElement("label");
    label.className = "count-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.count = String(count);
    input.dataset.ruleKind = kind;
    input.setAttribute("aria-label", `${kind} on ${count} neighbors`);

    const text = document.createElement("span");
    text.textContent = String(count);

    input.addEventListener("change", () => {
      const rule = kind === "birth" ? birthRule : survivalRule;
      if (input.checked) {
        rule.add(count);
      } else {
        rule.delete(count);
      }
      syncRuleControls();
    });

    label.append(input, text);
    container.append(label);
  }
}

function sampleRule() {
  const birth = [];
  const survival = [];
  for (let count = 0; count <= 8; count += 1) {
    if (Math.random() < 0.5) birth.push(count);
    if (Math.random() < 0.5) survival.push(count);
  }
  setRule(birth, survival);
  randomizeGrid();
}

function canvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  const x = Math.floor(((clientX - rect.left) / rect.width) * size);
  const y = Math.floor(((clientY - rect.top) / rect.height) * size);
  return {
    x: Math.max(0, Math.min(size - 1, x)),
    y: Math.max(0, Math.min(size - 1, y)),
  };
}

let drawing = false;
let drawValue = 1;
let lastDrawn = -1;

function paintAt(event) {
  event.preventDefault();
  const { x, y } = canvasPosition(event);
  const i = indexFor(x, y);
  if (i === lastDrawn) return;

  cells[i] = drawValue;
  lastDrawn = i;
  refreshLiveCount();
  draw();
}

function startPainting(event) {
  const { x, y } = canvasPosition(event);
  const i = indexFor(x, y);
  drawing = true;
  drawValue = cells[i] ? 0 : 1;
  lastDrawn = -1;
  paintAt(event);
}

function stopPainting() {
  drawing = false;
  lastDrawn = -1;
}

function logObservation() {
  const entry = {
    generation,
    rule: ruleString(),
    live: liveCells,
    activity: activityStat.textContent,
    note: observationText.value.trim(),
    grid: `${size}x${size}`,
    randomDensity: `${densityRange.value}%`,
  };

  observations.unshift(entry);
  observationText.value = "";
  renderObservationTable();
}

function renderObservationTable() {
  logTable.innerHTML = "";

  if (observations.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No observations logged yet.";
    row.append(cell);
    logTable.append(row);
    return;
  }

  observations.forEach((entry) => {
    const row = document.createElement("tr");
    [entry.generation, entry.rule, entry.live, entry.activity].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    if (entry.note) {
      row.title = entry.note;
    }
    logTable.append(row);
  });
}

function downloadCsv() {
  if (observations.length === 0) return;

  const header = ["generation", "rule", "live", "activity", "grid", "randomDensity", "note"];
  const rows = observations.map((entry) =>
    header
      .map((key) => `"${String(entry[key]).replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cellular-automata-observations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

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

  while (rules.length < 100) {
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

function countLiveState(state) {
  let live = 0;
  for (let i = 0; i < state.length; i += 1) live += state[i];
  return live;
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

function stepStudyWrapped(state, nextState, n, birthMask, survivalMask) {
  let live = 0;
  let changes = 0;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;

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

      nextState[i] = value ? 1 : 0;
      if (nextState[i] !== state[i]) changes += 1;

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
    bboxArea: live === 0 ? 0 : (maxX - minX + 1) * (maxY - minY + 1),
    centerX: live === 0 ? null : sumX / live,
    centerY: live === 0 ? null : sumY / live,
  };
}

function stepStudyBounded(state, nextState, n, birthMask, survivalMask) {
  let live = 0;
  let changes = 0;
  let minX = n;
  let minY = n;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let neighbors = 0;
      const i = y * n + x;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= n || ny < 0 || ny >= n) continue;
          neighbors += state[ny * n + nx];
        }
      }

      const alive = state[i] === 1;
      const value = alive
        ? (survivalMask & (1 << neighbors)) !== 0
        : (birthMask & (1 << neighbors)) !== 0;

      nextState[i] = value ? 1 : 0;
      if (nextState[i] !== state[i]) changes += 1;

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

function classifyStudyRun(finalStats, repeat, early, late, n, totalCells) {
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

function runStudyTrial(rule, trial, options, rng) {
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
    bboxArea: 0,
    centerX: null,
    centerY: null,
  };

  seen.set(`${hashState(state)}:${finalStats.live}`, 0);

  for (let step = 1; step <= options.steps; step += 1) {
    finalStats = options.wrap
      ? stepStudyWrapped(state, nextState, options.n, rule.birthMask, rule.survivalMask)
      : stepStudyBounded(state, nextState, options.n, rule.birthMask, rule.survivalMask);

    [state, nextState] = [nextState, state];

    if (step <= windowSize) addMetric(early, finalStats, totalCells);
    if (step > options.steps - windowSize) addMetric(late, finalStats, totalCells);

    const key = `${hashState(state)}:${finalStats.live}`;
    if (!repeat && seen.has(key)) {
      repeat = { firstStep: seen.get(key), step, period: step - seen.get(key) };
    } else if (!repeat) {
      seen.set(key, step);
    }
  }

  const classification = classifyStudyRun(finalStats, repeat, early, late, options.n, totalCells);

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

function aggregateStudyRule(rule, runs) {
  const counts = Object.fromEntries(primaryClasses.map((className) => [className, 0]));
  let avgFinalDensity = 0;
  let avgLastActivity = 0;
  let avgAreaTrend = 0;
  let mobileCount = 0;

  runs.forEach((run) => {
    counts[run.primaryClass] += 1;
    avgFinalDensity += run.finalDensity;
    avgLastActivity += run.avgLastActivity;
    avgAreaTrend += run.areaTrend;
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
    avgFinalDensity: avgFinalDensity / trialCount,
    avgLastActivity: avgLastActivity / trialCount,
    avgAreaTrend: avgAreaTrend / trialCount,
    tags: mobileCount > 0 ? `Mobile ${Math.round((mobileCount / trialCount) * 100)}%` : "",
  };
}

function setStudyBusy(isBusy) {
  runStudyButton.disabled = isBusy;
  cancelStudyButton.disabled = !isBusy;
  downloadStudyButton.disabled = isBusy || studyTrialRows.length === 0;
}

function updateStudySummary(rulesDone, totalRules, trialsDone) {
  const classCounts = Object.fromEntries(primaryClasses.map((className) => [className, 0]));
  studyTrialRows.forEach((row) => {
    classCounts[row.primaryClass] += 1;
  });
  const topClass = primaryClasses.reduce((best, className) =>
    classCounts[className] > classCounts[best] ? className : best
  );

  studyRulesStat.textContent = `${rulesDone}/${totalRules}`;
  studyTrialsStat.textContent = String(trialsDone);
  studyTopClassStat.textContent = trialsDone === 0 ? "None" : topClass;
}

function renderStudyTable() {
  studyTable.innerHTML = "";

  if (studyResults.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "Run the study to classify Conway, HighLife, and 98 sampled rules.";
    row.append(cell);
    studyTable.append(row);
    return;
  }

  studyResults.forEach((result) => {
    const row = document.createElement("tr");
    const values = [
      `${result.label} ${result.rule}`,
      result.dominantClass,
      result.distribution,
      result.avgFinalDensity.toFixed(3),
      result.avgLastActivity.toFixed(3),
      result.tags || "-",
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });

    studyTable.append(row);
  });
}

function downloadStudyCsv() {
  if (studyTrialRows.length === 0) return;

  const header = [
    "rule_label",
    "rule",
    "trial",
    "primary_class",
    "tags",
    "steps",
    "grid_size",
    "initial_density",
    "wrap",
    "final_live",
    "final_density",
    "final_activity",
    "avg_last_density",
    "avg_last_activity",
    "final_bounding_box_area",
    "avg_last_area",
    "density_trend",
    "area_trend",
    "repeat_period",
    "center_shift",
  ];
  const rows = studyTrialRows.map((row) =>
    [
      row.ruleLabel,
      row.rule,
      row.trial,
      row.primaryClass,
      row.tags.join("|"),
      row.steps,
      row.gridSize,
      row.initialDensity.toFixed(3),
      row.wrap,
      row.finalLive,
      row.finalDensity.toFixed(6),
      row.finalActivity.toFixed(6),
      row.avgLastDensity.toFixed(6),
      row.avgLastActivity.toFixed(6),
      row.finalBoundingBoxArea,
      row.avgLastArea.toFixed(6),
      row.densityTrend.toFixed(6),
      row.areaTrend.toFixed(6),
      row.repeatPeriod,
      row.centerShift.toFixed(6),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "task-3-rule-study.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function yieldToUi() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function runTaskThreeStudy() {
  setRunning(false);
  studyCancelled = false;
  studyResults = [];
  studyTrialRows = [];
  renderStudyTable();
  setStudyBusy(true);

  const options = {
    n: clampNumber(studyGridSize.value, 10, 300),
    steps: clampNumber(studySteps.value, 100, 1000),
    trials: clampNumber(studyTrials.value, 1, 10),
    density: clampNumber(studyDensity.value, 1, 90) / 100,
    wrap: wrapToggle.checked,
  };
  const rng = makeRng(studySeed.value);
  const rules = makeStudyRules(rng);
  const totalTrials = rules.length * options.trials;
  let trialsDone = 0;

  studyProgress.value = 0;
  studyStatus.textContent = "Running";
  updateStudySummary(0, rules.length, 0);

  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
    if (studyCancelled) break;

    const rule = rules[ruleIndex];
    const runs = [];

    for (let trial = 1; trial <= options.trials; trial += 1) {
      if (studyCancelled) break;

      const row = runStudyTrial(rule, trial, options, rng);
      runs.push(row);
      studyTrialRows.push(row);
      trialsDone += 1;
      studyProgress.value = (trialsDone / totalTrials) * 100;
      studyStatus.textContent = `Running ${trialsDone}/${totalTrials}`;

      if (trialsDone % 2 === 0) await yieldToUi();
    }

    if (runs.length > 0) {
      studyResults.push(aggregateStudyRule(rule, runs));
      renderStudyTable();
      updateStudySummary(studyResults.length, rules.length, trialsDone);
      await yieldToUi();
    }
  }

  if (studyCancelled) {
    studyStatus.textContent = "Cancelled";
  } else {
    studyStatus.textContent = "Complete";
    studyProgress.value = 100;
  }

  setStudyBusy(false);
}

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];
    setRule(preset.birth, preset.survival);
  });
});

runToggle.addEventListener("click", () => setRunning(!running));
stepButton.addEventListener("click", stepSimulation);
randomButton.addEventListener("click", randomizeGrid);
clearButton.addEventListener("click", clearGrid);
sampleRuleButton.addEventListener("click", sampleRule);
logButton.addEventListener("click", logObservation);
downloadButton.addEventListener("click", downloadCsv);
runStudyButton.addEventListener("click", runTaskThreeStudy);
cancelStudyButton.addEventListener("click", () => {
  studyCancelled = true;
  studyStatus.textContent = "Cancelling";
});
downloadStudyButton.addEventListener("click", downloadStudyCsv);

gridSize.addEventListener("change", () => resizeGrid(Math.min(Number(gridSize.value), 300)));
speedRange.addEventListener("input", () => {
  speedLabel.textContent = `${speedRange.value} gen/s`;
});
densityRange.addEventListener("input", () => {
  randomDensityLabel.textContent = `${densityRange.value}%`;
});

canvas.addEventListener("pointerdown", startPainting);
canvas.addEventListener("pointermove", (event) => {
  if (drawing) paintAt(event);
});
window.addEventListener("pointerup", stopPainting);
canvas.addEventListener("pointerleave", stopPainting);

makeRuleCheckboxes(birthCounts, "birth");
makeRuleCheckboxes(survivalCounts, "survival");
syncRuleControls();
randomizeGrid();
