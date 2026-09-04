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

const presets = {
  life: { birth: [3], survival: [2, 3] },
  highlife: { birth: [3, 6], survival: [2, 3] },
  seeds: { birth: [2], survival: [] },
  daynight: { birth: [3, 6, 7, 8], survival: [3, 4, 6, 7, 8] },
};

let size = Number(gridSize.value);
let cells = new Uint8Array(size * size);
let next = new Uint8Array(size * size);
let generation = 0;
let running = false;
let lastFrame = 0;
let liveCells = 0;
let births = 0;
let deaths = 0;
let observations = [];
let birthRule = new Set(presets.life.birth);
let survivalRule = new Set(presets.life.survival);

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

function syncRuleButtons() {
  document.querySelectorAll("[data-rule-kind]").forEach((button) => {
    const count = Number(button.dataset.count);
    const rule = button.dataset.ruleKind === "birth" ? birthRule : survivalRule;
    button.classList.toggle("active", rule.has(count));
    button.setAttribute("aria-pressed", String(rule.has(count)));
  });
  ruleDisplay.textContent = ruleString();
}

function setRule(birth, survival) {
  birthRule = new Set(birth);
  survivalRule = new Set(survival);
  syncRuleButtons();
}

function makeRuleButtons(container, kind) {
  for (let count = 0; count <= 8; count += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(count);
    button.dataset.count = String(count);
    button.dataset.ruleKind = kind;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const rule = kind === "birth" ? birthRule : survivalRule;
      if (rule.has(count)) {
        rule.delete(count);
      } else {
        rule.add(count);
      }
      syncRuleButtons();
    });
    container.append(button);
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

gridSize.addEventListener("change", () => resizeGrid(Number(gridSize.value)));
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

makeRuleButtons(birthCounts, "birth");
makeRuleButtons(survivalCounts, "survival");
syncRuleButtons();
randomizeGrid();

