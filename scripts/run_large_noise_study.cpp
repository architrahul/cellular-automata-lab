#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace fs = std::filesystem;

struct Config {
  int rules = 100;
  int trials = 1;
  int steps = 500;
  int n = 500;
  double density = 0.24;
  bool wrap = true;
  uint32_t seed = 202609;
  std::vector<double> noise = {0.0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0};
};

struct Rng {
  uint32_t state;

  explicit Rng(uint32_t seed) : state(seed == 0 ? 1 : seed) {}

  uint32_t nextU32() {
    state = state * 1664525u + 1013904223u;
    return state;
  }

  double nextDouble() {
    return static_cast<double>(nextU32()) / 4294967296.0;
  }
};

struct Rule {
  std::string label;
  int birthMask = 0;
  int survivalMask = 0;
};

struct Stats {
  int live = 0;
  int changes = 0;
  uint64_t hash = 1469598103934665603ull;
  int bboxArea = 0;
  double centerX = 0.0;
  double centerY = 0.0;
  bool hasCenter = false;
};

struct Accumulator {
  int count = 0;
  double density = 0.0;
  double activity = 0.0;
  double area = 0.0;
  double centerX = 0.0;
  double centerY = 0.0;
  int centerCount = 0;
};

struct TrialRow {
  double noise = 0.0;
  std::string ruleLabel;
  std::string rule;
  int trial = 0;
  std::string primaryClass;
  std::string tags;
  int steps = 0;
  int gridSize = 0;
  double initialDensity = 0.0;
  bool wrap = true;
  int finalLive = 0;
  double finalDensity = 0.0;
  double finalActivity = 0.0;
  double avgLastDensity = 0.0;
  double avgLastActivity = 0.0;
  int finalBoundingBoxArea = 0;
  double avgLastArea = 0.0;
  double densityTrend = 0.0;
  double areaTrend = 0.0;
  int repeatPeriod = 0;
  double centerShift = 0.0;
};

struct SummaryRow {
  double noise = 0.0;
  std::string label;
  std::string rule;
  std::string dominantClass;
  std::string distribution;
  double extinctPct = 0.0;
  double frozenPct = 0.0;
  double periodicPct = 0.0;
  double expandingPct = 0.0;
  double disorderedPct = 0.0;
  double structuredPct = 0.0;
  double boundedPct = 0.0;
  double avgFinalDensity = 0.0;
  double avgLastActivity = 0.0;
  double avgLastArea = 0.0;
  double avgDensityTrend = 0.0;
  double avgAreaTrend = 0.0;
  double avgCenterShift = 0.0;
  double mobilePct = 0.0;
};

const std::vector<std::string> kPrimaryClasses = {
    "Extinct",
    "Frozen",
    "Periodic",
    "Expanding",
    "Disordered",
    "Structured Dynamic",
    "Bounded Dynamic",
};

int maskFromCounts(const std::vector<int>& counts) {
  int mask = 0;
  for (int count : counts) mask |= 1 << count;
  return mask;
}

std::string ruleString(int birthMask, int survivalMask) {
  std::ostringstream out;
  out << "B";
  for (int count = 0; count <= 8; ++count) {
    if (birthMask & (1 << count)) out << count;
  }
  out << "/S";
  for (int count = 0; count <= 8; ++count) {
    if (survivalMask & (1 << count)) out << count;
  }
  return out.str();
}

int ruleCode(int birthMask, int survivalMask) {
  return birthMask | (survivalMask << 9);
}

uint32_t mixSeed(uint32_t seed, int noiseIndex, int ruleIndex, int trial) {
  uint32_t x = seed;
  x ^= static_cast<uint32_t>(noiseIndex + 1) * 0x9e3779b9u;
  x ^= static_cast<uint32_t>(ruleIndex + 1) * 0x85ebca6bu;
  x ^= static_cast<uint32_t>(trial + 1) * 0xc2b2ae35u;
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x == 0 ? 1 : x;
}

std::vector<Rule> makeRules(const Config& config) {
  Rng rng(config.seed);
  std::vector<Rule> rules = {
      {"Conway Life", maskFromCounts({3}), maskFromCounts({2, 3})},
      {"HighLife", maskFromCounts({3, 6}), maskFromCounts({2, 3})},
  };
  std::unordered_map<int, bool> seen;
  for (const auto& rule : rules) seen[ruleCode(rule.birthMask, rule.survivalMask)] = true;

  while (static_cast<int>(rules.size()) < config.rules) {
    int birthMask = 0;
    int survivalMask = 0;
    for (int count = 0; count <= 8; ++count) {
      if (rng.nextDouble() < 0.5) birthMask |= 1 << count;
      if (rng.nextDouble() < 0.5) survivalMask |= 1 << count;
    }
    const int code = ruleCode(birthMask, survivalMask);
    if (seen[code]) continue;
    seen[code] = true;

    std::ostringstream label;
    label << "Sample " << std::setw(2) << std::setfill('0') << (rules.size() - 1);
    rules.push_back({label.str(), birthMask, survivalMask});
  }
  return rules;
}

uint64_t hashState(const std::vector<uint8_t>& state) {
  uint64_t hash = 1469598103934665603ull;
  for (uint8_t value : state) {
    hash ^= value;
    hash *= 1099511628211ull;
  }
  return hash;
}

std::vector<uint8_t> randomState(int n, double density, Rng& rng) {
  std::vector<uint8_t> state(static_cast<size_t>(n) * n);
  for (uint8_t& value : state) value = rng.nextDouble() < density ? 1 : 0;
  return state;
}

int countLive(const std::vector<uint8_t>& state) {
  int live = 0;
  for (uint8_t value : state) live += value;
  return live;
}

Stats stepWrapped(
    const std::vector<uint8_t>& state,
    std::vector<uint8_t>& next,
    int n,
    int birthMask,
    int survivalMask,
    double noise,
    Rng& rng) {
  Stats stats;
  int minX = n;
  int minY = n;
  int maxX = -1;
  int maxY = -1;
  double sumX = 0.0;
  double sumY = 0.0;
  uint64_t hash = 1469598103934665603ull;
  const bool noisy = noise > 0.0;
  const bool invertAll = noise >= 1.0;

  for (int y = 0; y < n; ++y) {
    const int row = y * n;
    const int up = (y == 0 ? n - 1 : y - 1) * n;
    const int down = (y == n - 1 ? 0 : y + 1) * n;

    for (int x = 0; x < n; ++x) {
      const int left = x == 0 ? n - 1 : x - 1;
      const int right = x == n - 1 ? 0 : x + 1;
      const int i = row + x;
      const int neighbors =
          state[up + left] +
          state[up + x] +
          state[up + right] +
          state[row + left] +
          state[row + right] +
          state[down + left] +
          state[down + x] +
          state[down + right];
      const bool alive = state[i] == 1;
      bool value = alive ? ((survivalMask & (1 << neighbors)) != 0) : ((birthMask & (1 << neighbors)) != 0);

      if (invertAll || (noisy && rng.nextDouble() < noise)) value = !value;

      const uint8_t nextValue = value ? 1 : 0;
      next[i] = nextValue;
      hash ^= nextValue;
      hash *= 1099511628211ull;

      if (nextValue != state[i]) stats.changes += 1;
      if (!value) continue;

      stats.live += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
    }
  }

  stats.hash = hash;
  stats.bboxArea = stats.live == 0 ? 0 : (maxX - minX + 1) * (maxY - minY + 1);
  stats.hasCenter = stats.live > 0;
  if (stats.hasCenter) {
    stats.centerX = sumX / stats.live;
    stats.centerY = sumY / stats.live;
  }
  return stats;
}

void addMetric(Accumulator& acc, const Stats& stats, int totalCells) {
  acc.count += 1;
  acc.density += static_cast<double>(stats.live) / totalCells;
  acc.activity += static_cast<double>(stats.changes) / totalCells;
  acc.area += static_cast<double>(stats.bboxArea) / totalCells;
  if (stats.hasCenter) {
    acc.centerX += stats.centerX;
    acc.centerY += stats.centerY;
    acc.centerCount += 1;
  }
}

double averageMetric(const Accumulator& acc, double Accumulator::*field) {
  return acc.count == 0 ? 0.0 : acc.*field / acc.count;
}

double averageCenter(const Accumulator& acc, double Accumulator::*field) {
  return acc.centerCount == 0 ? -1.0 : acc.*field / acc.centerCount;
}

TrialRow classifyRun(
    const Config& config,
    const Rule& rule,
    int trial,
    double noise,
    const Stats& finalStats,
    int repeatPeriod,
    const Accumulator& early,
    const Accumulator& late) {
  const int totalCells = config.n * config.n;
  const double finalDensity = static_cast<double>(finalStats.live) / totalCells;
  const double finalActivity = static_cast<double>(finalStats.changes) / totalCells;
  const double avgEarlyDensity = averageMetric(early, &Accumulator::density);
  const double avgLastDensity = averageMetric(late, &Accumulator::density);
  const double avgLastActivity = averageMetric(late, &Accumulator::activity);
  const double avgEarlyArea = averageMetric(early, &Accumulator::area);
  const double avgLastArea = averageMetric(late, &Accumulator::area);
  const double densityTrend = avgLastDensity - avgEarlyDensity;
  const double areaTrend = avgLastArea - avgEarlyArea;
  const double earlyCenterX = averageCenter(early, &Accumulator::centerX);
  const double earlyCenterY = averageCenter(early, &Accumulator::centerY);
  const double lateCenterX = averageCenter(late, &Accumulator::centerX);
  const double lateCenterY = averageCenter(late, &Accumulator::centerY);

  std::string primaryClass = "Bounded Dynamic";
  if (finalStats.live == 0) {
    primaryClass = "Extinct";
  } else if (finalActivity <= 1.0 / totalCells || repeatPeriod == 1) {
    primaryClass = "Frozen";
  } else if (repeatPeriod > 1) {
    primaryClass = "Periodic";
  } else if (areaTrend > 0.12 || densityTrend > 0.08 || (avgLastDensity > 0.65 && avgLastActivity > 0.08)) {
    primaryClass = "Expanding";
  } else if (avgLastActivity > 0.12 && avgLastDensity > 0.35) {
    primaryClass = "Disordered";
  } else if (avgLastActivity > 0.01) {
    primaryClass = avgLastArea < 0.65 || avgLastDensity < 0.35 ? "Structured Dynamic" : "Disordered";
  }

  double centerShift = 0.0;
  if (earlyCenterX >= 0.0 && earlyCenterY >= 0.0 && lateCenterX >= 0.0 && lateCenterY >= 0.0) {
    centerShift = std::hypot(lateCenterX - earlyCenterX, lateCenterY - earlyCenterY) / config.n;
  }

  std::string tags;
  if (centerShift > 0.12 && avgLastActivity > 0.005 && avgLastArea < 0.65) tags = "Mobile";

  return {
      noise,
      rule.label,
      ruleString(rule.birthMask, rule.survivalMask),
      trial,
      primaryClass,
      tags,
      config.steps,
      config.n,
      config.density,
      config.wrap,
      finalStats.live,
      finalDensity,
      finalActivity,
      avgLastDensity,
      avgLastActivity,
      finalStats.bboxArea,
      avgLastArea,
      densityTrend,
      areaTrend,
      repeatPeriod,
      centerShift,
  };
}

TrialRow runTrial(const Config& config, const Rule& rule, int noiseIndex, int ruleIndex, int trial) {
  Rng initRng(mixSeed(config.seed, 0, ruleIndex, trial));
  Rng noiseRng(mixSeed(config.seed ^ 0xa5a5a5a5u, noiseIndex, ruleIndex, trial));
  std::vector<uint8_t> state = randomState(config.n, config.density, initRng);
  std::vector<uint8_t> next(static_cast<size_t>(config.n) * config.n);
  const int totalCells = config.n * config.n;
  const int windowSize = std::max(20, config.steps / 5);
  Accumulator early;
  Accumulator late;
  std::unordered_map<uint64_t, int> seen;
  const int initialLive = countLive(state);
  uint64_t key = hashState(state) ^ (static_cast<uint64_t>(initialLive) << 32);
  seen[key] = 0;
  int repeatPeriod = 0;
  Stats finalStats;

  for (int step = 1; step <= config.steps; ++step) {
    finalStats = stepWrapped(
        state,
        next,
        config.n,
        rule.birthMask,
        rule.survivalMask,
        config.noise[noiseIndex],
        noiseRng);
    state.swap(next);

    if (step <= windowSize) addMetric(early, finalStats, totalCells);
    if (step > config.steps - windowSize) addMetric(late, finalStats, totalCells);

    key = finalStats.hash ^ (static_cast<uint64_t>(finalStats.live) << 32);
    if (repeatPeriod == 0) {
      auto it = seen.find(key);
      if (it != seen.end()) {
        repeatPeriod = step - it->second;
      } else {
        seen[key] = step;
      }
    }
  }

  return classifyRun(config, rule, trial, config.noise[noiseIndex], finalStats, repeatPeriod, early, late);
}

SummaryRow aggregateRule(double noise, const Rule& rule, const std::vector<TrialRow>& rows) {
  std::map<std::string, int> counts;
  for (const auto& className : kPrimaryClasses) counts[className] = 0;

  SummaryRow summary;
  summary.noise = noise;
  summary.label = rule.label;
  summary.rule = ruleString(rule.birthMask, rule.survivalMask);

  for (const auto& row : rows) {
    counts[row.primaryClass] += 1;
    summary.avgFinalDensity += row.finalDensity;
    summary.avgLastActivity += row.avgLastActivity;
    summary.avgLastArea += row.avgLastArea;
    summary.avgDensityTrend += row.densityTrend;
    summary.avgAreaTrend += row.areaTrend;
    summary.avgCenterShift += row.centerShift;
    if (row.tags.find("Mobile") != std::string::npos) summary.mobilePct += 1.0;
  }

  const double total = rows.empty() ? 1.0 : static_cast<double>(rows.size());
  summary.dominantClass = kPrimaryClasses.front();
  for (const auto& className : kPrimaryClasses) {
    if (counts[className] > counts[summary.dominantClass]) summary.dominantClass = className;
  }

  std::ostringstream distribution;
  bool first = true;
  for (const auto& className : kPrimaryClasses) {
    if (counts[className] == 0) continue;
    if (!first) distribution << " / ";
    first = false;
    distribution << className << ": " << std::llround((counts[className] / total) * 100.0) << "%";
  }
  summary.distribution = distribution.str();

  summary.extinctPct = counts["Extinct"] / total;
  summary.frozenPct = counts["Frozen"] / total;
  summary.periodicPct = counts["Periodic"] / total;
  summary.expandingPct = counts["Expanding"] / total;
  summary.disorderedPct = counts["Disordered"] / total;
  summary.structuredPct = counts["Structured Dynamic"] / total;
  summary.boundedPct = counts["Bounded Dynamic"] / total;
  summary.avgFinalDensity /= total;
  summary.avgLastActivity /= total;
  summary.avgLastArea /= total;
  summary.avgDensityTrend /= total;
  summary.avgAreaTrend /= total;
  summary.avgCenterShift /= total;
  summary.mobilePct /= total;
  return summary;
}

std::string csvEscape(const std::string& value) {
  std::string out = "\"";
  for (char c : value) out += c == '"' ? "\"\"" : std::string(1, c);
  out += "\"";
  return out;
}

std::string fixed(double value, int digits = 6) {
  std::ostringstream out;
  out << std::fixed << std::setprecision(digits) << value;
  return out.str();
}

std::string percent(double value) {
  return std::to_string(static_cast<int>(std::llround(value * 100.0))) + "%";
}

void writeTrialCsv(const fs::path& filePath, const std::vector<TrialRow>& rows) {
  std::ofstream out(filePath);
  out << "noise,ruleLabel,rule,trial,primaryClass,tags,steps,gridSize,initialDensity,wrap,finalLive,finalDensity,finalActivity,avgLastDensity,avgLastActivity,finalBoundingBoxArea,avgLastArea,densityTrend,areaTrend,repeatPeriod,centerShift\n";
  for (const auto& row : rows) {
    out << fixed(row.noise, 3) << ","
        << csvEscape(row.ruleLabel) << ","
        << csvEscape(row.rule) << ","
        << row.trial << ","
        << csvEscape(row.primaryClass) << ","
        << csvEscape(row.tags) << ","
        << row.steps << ","
        << row.gridSize << ","
        << fixed(row.initialDensity, 3) << ","
        << (row.wrap ? "true" : "false") << ","
        << row.finalLive << ","
        << fixed(row.finalDensity) << ","
        << fixed(row.finalActivity) << ","
        << fixed(row.avgLastDensity) << ","
        << fixed(row.avgLastActivity) << ","
        << row.finalBoundingBoxArea << ","
        << fixed(row.avgLastArea) << ","
        << fixed(row.densityTrend) << ","
        << fixed(row.areaTrend) << ","
        << row.repeatPeriod << ","
        << fixed(row.centerShift) << "\n";
  }
}

void writeSummaryCsv(const fs::path& filePath, const std::vector<SummaryRow>& rows) {
  std::ofstream out(filePath);
  out << "noise,label,rule,dominantClass,distribution,extinctPct,frozenPct,periodicPct,expandingPct,disorderedPct,structuredPct,boundedPct,avgFinalDensity,avgLastActivity,avgLastArea,avgDensityTrend,avgAreaTrend,avgCenterShift,mobilePct\n";
  for (const auto& row : rows) {
    out << fixed(row.noise, 3) << ","
        << csvEscape(row.label) << ","
        << csvEscape(row.rule) << ","
        << csvEscape(row.dominantClass) << ","
        << csvEscape(row.distribution) << ","
        << fixed(row.extinctPct, 3) << ","
        << fixed(row.frozenPct, 3) << ","
        << fixed(row.periodicPct, 3) << ","
        << fixed(row.expandingPct, 3) << ","
        << fixed(row.disorderedPct, 3) << ","
        << fixed(row.structuredPct, 3) << ","
        << fixed(row.boundedPct, 3) << ","
        << fixed(row.avgFinalDensity) << ","
        << fixed(row.avgLastActivity) << ","
        << fixed(row.avgLastArea) << ","
        << fixed(row.avgDensityTrend) << ","
        << fixed(row.avgAreaTrend) << ","
        << fixed(row.avgCenterShift) << ","
        << fixed(row.mobilePct, 3) << "\n";
  }
}

std::vector<std::string> parseCsvLine(const std::string& line) {
  std::vector<std::string> fields;
  std::string field;
  bool quoted = false;
  for (size_t i = 0; i < line.size(); ++i) {
    const char c = line[i];
    if (quoted) {
      if (c == '"' && i + 1 < line.size() && line[i + 1] == '"') {
        field += '"';
        ++i;
      } else if (c == '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c == '"') {
      quoted = true;
    } else if (c == ',') {
      fields.push_back(field);
      field.clear();
    } else {
      field += c;
    }
  }
  fields.push_back(field);
  return fields;
}

std::map<std::string, std::string> loadPreviousClasses(const fs::path& filePath) {
  std::map<std::string, std::string> classes;
  std::ifstream in(filePath);
  std::string line;
  std::getline(in, line);
  while (std::getline(in, line)) {
    const auto fields = parseCsvLine(line);
    if (fields.size() > 2) classes[fields[0]] = fields[2];
  }
  return classes;
}

void writeChangesCsv(
    const fs::path& filePath,
    const std::vector<SummaryRow>& oldRows,
    const std::vector<SummaryRow>& newRows,
    const std::string& oldLabel,
    const std::string& newLabel) {
  std::map<std::string, SummaryRow> oldByRule;
  for (const auto& row : oldRows) oldByRule[row.label] = row;

  std::ofstream out(filePath);
  out << "label,rule," << oldLabel << "," << newLabel << ",oldDistribution,newDistribution,changed\n";
  for (const auto& row : newRows) {
    const auto oldIt = oldByRule.find(row.label);
    if (oldIt == oldByRule.end()) continue;
    const bool changed = oldIt->second.dominantClass != row.dominantClass;
    out << csvEscape(row.label) << ","
        << csvEscape(row.rule) << ","
        << csvEscape(oldIt->second.dominantClass) << ","
        << csvEscape(row.dominantClass) << ","
        << csvEscape(oldIt->second.distribution) << ","
        << csvEscape(row.distribution) << ","
        << (changed ? "true" : "false") << "\n";
  }
}

std::vector<SummaryRow> readOld100Summary(const fs::path& filePath) {
  std::vector<SummaryRow> rows;
  std::ifstream in(filePath);
  std::string line;
  std::getline(in, line);
  while (std::getline(in, line)) {
    const auto f = parseCsvLine(line);
    if (f.size() < 18) continue;
    SummaryRow row;
    row.noise = 0.0;
    row.label = f[0];
    row.rule = f[1];
    row.dominantClass = f[2];
    row.distribution = f[3];
    row.extinctPct = std::stod(f[4]);
    row.frozenPct = std::stod(f[5]);
    row.periodicPct = std::stod(f[6]);
    row.expandingPct = std::stod(f[7]);
    row.disorderedPct = std::stod(f[8]);
    row.structuredPct = std::stod(f[9]);
    row.boundedPct = std::stod(f[10]);
    row.avgFinalDensity = std::stod(f[11]);
    row.avgLastActivity = std::stod(f[12]);
    row.avgLastArea = std::stod(f[13]);
    row.avgDensityTrend = std::stod(f[14]);
    row.avgAreaTrend = std::stod(f[15]);
    row.avgCenterShift = std::stod(f[16]);
    row.mobilePct = std::stod(f[17]);
    rows.push_back(row);
  }
  return rows;
}

void writeNoiseChangesCsv(
    const fs::path& filePath,
    const std::vector<SummaryRow>& zeroRows,
    const std::vector<SummaryRow>& allRows) {
  std::map<std::string, SummaryRow> baseline;
  for (const auto& row : zeroRows) baseline[row.label] = row;

  std::ofstream out(filePath);
  out << "noise,label,rule,baselineClass,noiseClass,baselineDistribution,noiseDistribution,changed\n";
  for (const auto& row : allRows) {
    const auto base = baseline.find(row.label);
    if (base == baseline.end() || row.noise == 0.0) continue;
    const bool changed = base->second.dominantClass != row.dominantClass;
    out << fixed(row.noise, 3) << ","
        << csvEscape(row.label) << ","
        << csvEscape(row.rule) << ","
        << csvEscape(base->second.dominantClass) << ","
        << csvEscape(row.dominantClass) << ","
        << csvEscape(base->second.distribution) << ","
        << csvEscape(row.distribution) << ","
        << (changed ? "true" : "false") << "\n";
  }
}

void writeMarkdownSummary(
    const fs::path& filePath,
    const Config& config,
    const std::vector<SummaryRow>& old100,
    const std::vector<SummaryRow>& zeroRows,
    const std::vector<SummaryRow>& allRows,
    double elapsedSeconds) {
  std::map<std::string, SummaryRow> oldByLabel;
  std::map<std::string, SummaryRow> zeroByLabel;
  for (const auto& row : old100) oldByLabel[row.label] = row;
  for (const auto& row : zeroRows) zeroByLabel[row.label] = row;

  int changed500 = 0;
  for (const auto& row : zeroRows) {
    const auto oldIt = oldByLabel.find(row.label);
    if (oldIt != oldByLabel.end() && oldIt->second.dominantClass != row.dominantClass) changed500 += 1;
  }

  std::map<std::string, int> zeroClassCounts;
  for (const auto& className : kPrimaryClasses) zeroClassCounts[className] = 0;
  for (const auto& row : zeroRows) zeroClassCounts[row.dominantClass] += 1;

  std::map<double, int> noiseChangedCounts;
  for (const auto& row : allRows) {
    if (row.noise == 0.0) continue;
    const auto base = zeroByLabel.find(row.label);
    if (base != zeroByLabel.end() && base->second.dominantClass != row.dominantClass) {
      noiseChangedCounts[row.noise] += 1;
    }
  }

  std::ofstream out(filePath);
  out << "# 500 x 500 Rule Study and Noise Sweep\n\n";
  out << "Generated: " << [] {
    const auto now = std::chrono::system_clock::now();
    const std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm tm = *std::gmtime(&t);
    std::ostringstream s;
    s << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return s.str();
  }() << "\n\n";
  out << "## Configuration\n\n";
  out << "- Rules: " << config.rules << " (Conway Life, HighLife, and " << config.rules - 2 << " seeded random rules)\n";
  out << "- Trials per rule per noise value: " << config.trials << "\n";
  out << "- Steps per trial: " << config.steps << "\n";
  out << "- Grid: " << config.n << " x " << config.n << "\n";
  out << "- Initial density: " << percent(config.density) << "\n";
  out << "- Edge handling: wrapped torus\n";
  out << "- Seed: " << config.seed << "\n";
  out << "- Initial-state control: each rule/trial starts from the same grid at every noise probability\n";
  out << "- Noise probabilities: ";
  for (size_t i = 0; i < config.noise.size(); ++i) {
    if (i) out << ", ";
    out << fixed(config.noise[i], 3);
  }
  out << "\n";
  out << "- Runtime: " << fixed(elapsedSeconds, 1) << " seconds\n\n";

  out << "## 500 x 500 Baseline Classes\n\n";
  for (const auto& className : kPrimaryClasses) out << "- " << className << ": " << zeroClassCounts[className] << " rules\n";
  out << "\nClassification changed from the prior 100 x 100, 10-trial run for " << changed500 << " of 100 rules.\n\n";

  out << "## Pinned Rules at 500 x 500, No Noise\n\n";
  out << "| Rule label | Rule | Dominant class | Distribution | Avg density | Avg activity |\n";
  out << "| --- | --- | --- | --- | --- | --- |\n";
  for (const auto& label : {"Conway Life", "HighLife"}) {
    const auto row = zeroByLabel[label];
    out << "| " << row.label << " | " << row.rule << " | " << row.dominantClass << " | " << row.distribution
        << " | " << fixed(row.avgFinalDensity, 3) << " | " << fixed(row.avgLastActivity, 3) << " |\n";
  }

  out << "\n## Noise Sensitivity\n\n";
  out << "| Noise p | Rules whose dominant class changed from p=0 |\n";
  out << "| --- | ---: |\n";
  for (double p : config.noise) {
    if (p == 0.0) continue;
    out << "| " << fixed(p, 3) << " | " << noiseChangedCounts[p] << " |\n";
  }

  out << "\n## Pinned Rule Noise Response\n\n";
  out << "| Noise p | Rule label | Dominant class | Avg density | Avg activity |\n";
  out << "| --- | --- | --- | ---: | ---: |\n";
  for (double p : config.noise) {
    for (const auto& label : {"Conway Life", "HighLife"}) {
      for (const auto& row : allRows) {
        if (row.noise == p && row.label == label) {
          out << "| " << fixed(p, 3) << " | " << row.label << " | " << row.dominantClass
              << " | " << fixed(row.avgFinalDensity, 3)
              << " | " << fixed(row.avgLastActivity, 3) << " |\n";
        }
      }
    }
  }

  out << "\n## Rules Changed by 500 x 500 Baseline\n\n";
  out << "| Rule label | Rule | 100 x 100 class | 500 x 500 class |\n";
  out << "| --- | --- | --- | --- |\n";
  for (const auto& row : zeroRows) {
    const auto oldIt = oldByLabel.find(row.label);
    if (oldIt != oldByLabel.end() && oldIt->second.dominantClass != row.dominantClass) {
      out << "| " << row.label << " | " << row.rule << " | " << oldIt->second.dominantClass << " | " << row.dominantClass << " |\n";
    }
  }

  out << "\n## Noise-Caused Changes\n\n";
  out << "| Noise p | Rule label | Rule | p=0 class | Noisy class |\n";
  out << "| --- | --- | --- | --- | --- |\n";
  int listed = 0;
  for (const auto& row : allRows) {
    if (row.noise == 0.0) continue;
    const auto base = zeroByLabel.find(row.label);
    if (base != zeroByLabel.end() && base->second.dominantClass != row.dominantClass) {
      out << "| " << fixed(row.noise, 3) << " | " << row.label << " | " << row.rule << " | " << base->second.dominantClass
          << " | " << row.dominantClass << " |\n";
      listed += 1;
      if (listed >= 80) {
        out << "| ... | ... | ... | ... | ... |\n";
        break;
      }
    }
  }

  out << "\n## Interpretation Notes\n\n";
  out << "The noise operation flips each cell after the rule update with probability p. The p=0 row is the 500 x 500 baseline. "
      << "For a given rule/trial, the starting grid is reused across all noise probabilities so the comparison focuses on perturbation strength. "
      << "Dominant classes are based on " << config.trials << " trials per rule/noise value, so changed rules should be treated as candidates for longer or repeated follow-up runs rather than final conclusions.\n";
}

int main() {
  const Config config;
  const auto start = std::chrono::steady_clock::now();
  const std::vector<Rule> rules = makeRules(config);
  const int totalJobs = static_cast<int>(config.noise.size()) * config.rules * config.trials;
  std::vector<TrialRow> trialRows(totalJobs);
  std::atomic<int> nextJob{0};
  std::atomic<int> done{0};
  std::mutex coutMutex;
  const unsigned hw = std::max(1u, std::thread::hardware_concurrency());
  const unsigned threadCount = std::min(hw, 8u);

  auto worker = [&]() {
    while (true) {
      const int job = nextJob.fetch_add(1);
      if (job >= totalJobs) break;

      const int trial = job % config.trials;
      const int ruleIndex = (job / config.trials) % config.rules;
      const int noiseIndex = job / (config.trials * config.rules);
      trialRows[job] = runTrial(config, rules[ruleIndex], noiseIndex, ruleIndex, trial + 1);

      const int completed = done.fetch_add(1) + 1;
      if (completed % 50 == 0 || completed % (config.rules * config.trials) == 0 || completed == totalJobs) {
        const int currentNoise = std::min(
            static_cast<int>(config.noise.size()) - 1,
            (completed - 1) / (config.rules * config.trials));
        const auto now = std::chrono::steady_clock::now();
        const double elapsed = std::chrono::duration<double>(now - start).count();
        std::lock_guard<std::mutex> lock(coutMutex);
        std::cout << "Completed " << completed << "/" << totalJobs << " trials";
        std::cout << " at noise p=" << fixed(config.noise[currentNoise], 3);
        std::cout << " in " << fixed(elapsed, 1) << "s\n";
      }
    }
  };

  std::vector<std::thread> threads;
  for (unsigned i = 0; i < threadCount; ++i) threads.emplace_back(worker);
  for (auto& thread : threads) thread.join();

  std::vector<SummaryRow> summaryRows;
  std::vector<SummaryRow> zeroRows;
  for (size_t noiseIndex = 0; noiseIndex < config.noise.size(); ++noiseIndex) {
    for (int ruleIndex = 0; ruleIndex < config.rules; ++ruleIndex) {
      std::vector<TrialRow> rows;
      for (int trial = 0; trial < config.trials; ++trial) {
        const int job = static_cast<int>(noiseIndex) * config.rules * config.trials + ruleIndex * config.trials + trial;
        rows.push_back(trialRows[job]);
      }
      SummaryRow summary = aggregateRule(config.noise[noiseIndex], rules[ruleIndex], rows);
      summaryRows.push_back(summary);
      if (config.noise[noiseIndex] == 0.0) zeroRows.push_back(summary);
    }
  }

  const fs::path resultsDir = fs::current_path() / "results";
  fs::create_directories(resultsDir);
  writeTrialCsv(resultsDir / "task3_500_noise_trials.csv", trialRows);
  writeSummaryCsv(resultsDir / "task3_500_noise_rule_summary.csv", summaryRows);
  writeSummaryCsv(resultsDir / "task3_500_baseline_rule_summary.csv", zeroRows);

  const auto old100 = readOld100Summary(resultsDir / "task3_rule_summary.csv");
  writeChangesCsv(resultsDir / "task3_500_vs_100_changes.csv", old100, zeroRows, "class100", "class500");
  writeNoiseChangesCsv(resultsDir / "task3_noise_class_changes.csv", zeroRows, summaryRows);

  const auto finish = std::chrono::steady_clock::now();
  const double elapsed = std::chrono::duration<double>(finish - start).count();
  writeMarkdownSummary(resultsDir / "task3_500_noise_summary.md", config, old100, zeroRows, summaryRows, elapsed);

  std::cout << "Wrote results/task3_500_baseline_rule_summary.csv\n";
  std::cout << "Wrote results/task3_500_noise_rule_summary.csv\n";
  std::cout << "Wrote results/task3_500_noise_trials.csv\n";
  std::cout << "Wrote results/task3_500_vs_100_changes.csv\n";
  std::cout << "Wrote results/task3_noise_class_changes.csv\n";
  std::cout << "Wrote results/task3_500_noise_summary.md\n";
}
