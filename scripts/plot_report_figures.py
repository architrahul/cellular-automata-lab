#!/usr/bin/env python3
import csv
import html
from collections import Counter
from pathlib import Path


CLASSES = [
    "Extinct",
    "Frozen",
    "Periodic",
    "Expanding",
    "Disordered",
    "Structured Dynamic",
    "Bounded Dynamic",
]

COLORS = {
    "Extinct": "#4b5563",
    "Frozen": "#2563eb",
    "Periodic": "#7c3aed",
    "Expanding": "#dc2626",
    "Disordered": "#d97706",
    "Structured Dynamic": "#059669",
    "Bounded Dynamic": "#0891b2",
}


def esc(value):
    return html.escape(str(value))


def text(x, y, value, size=13, anchor="middle", weight="400", rotate=None):
    transform = f' transform="rotate({rotate} {x} {y})"' if rotate else ""
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" '
        f'text-anchor="{anchor}" fill="#111827"{transform}>{esc(value)}</text>'
    )


def load_rule_classes(path, class_column):
    counts = Counter()
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            counts[row[class_column]] += 1
    return counts


def load_noise_changes(path):
    counts = Counter()
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            if row["changed"] == "true":
                counts[row["noise"]] += 1
    return dict(sorted(counts.items(), key=lambda item: float(item[0])))


def render_baseline_comparison(results):
    counts_100 = load_rule_classes(results / "task3_rule_summary.csv", "dominantClass")
    counts_500 = load_rule_classes(results / "task3_500_baseline_rule_summary.csv", "dominantClass")

    width = 1120
    height = 620
    margin = {"top": 78, "right": 32, "bottom": 130, "left": 74}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_count = max(max(counts_100.values()), max(counts_500.values()))
    max_count = ((max_count + 9) // 10) * 10
    group_w = plot_w / len(CLASSES)
    bar_w = 34
    y_base = margin["top"] + plot_h
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">Baseline Class Counts by Grid Size</title>",
        "<desc id=\"desc\">Grouped bar chart comparing 100 by 100 and 500 by 500 dominant rule classifications.</desc>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        text(width / 2, 34, "Baseline Rule Classification by Grid Size", 22, weight="700"),
        text(width / 2, 58, "100 rules, 500 generations, 24% initial live-cell density", 13),
        f'<rect x="{margin["left"]}" y="{margin["top"]}" width="{plot_w}" height="{plot_h}" fill="#ffffff" stroke="#d1d5db"/>',
    ]

    for tick in range(0, max_count + 1, 10):
        y = y_base - tick / max_count * plot_h
        parts.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{margin["left"] + plot_w}" y2="{y:.1f}" stroke="#e5e7eb"/>')
        parts.append(text(margin["left"] - 12, y + 4, tick, 12, anchor="end"))

    for index, class_name in enumerate(CLASSES):
        group_x = margin["left"] + index * group_w + group_w / 2
        values = [("100 x 100", counts_100[class_name], "#64748b"), ("500 x 500", counts_500[class_name], COLORS[class_name])]
        for bar_index, (label, value, color) in enumerate(values):
            x = group_x - bar_w - 4 + bar_index * (bar_w + 8)
            h = value / max_count * plot_h
            y = y_base - h
            parts.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w}" height="{h:.1f}" fill="{color}">'
                f"<title>{esc(label)}, {esc(class_name)}: {value} rules</title></rect>"
            )
            if value > 0:
                parts.append(text(x + bar_w / 2, y - 6, value, 11))
        label = class_name.replace("Structured Dynamic", "Structured").replace("Bounded Dynamic", "Bounded")
        parts.append(text(group_x, y_base + 22, label, 11, rotate=-28))

    parts.append(text(margin["left"] + plot_w / 2, height - 28, "Dominant rule class", 14, weight="700"))
    parts.append(text(22, margin["top"] + plot_h / 2, "Number of rules", 14, weight="700", rotate=-90))
    legend_y = height - 88
    parts.append('<rect x="414" y="512" width="14" height="14" fill="#64748b"/>')
    parts.append(text(436, legend_y + 13, "100 x 100", 13, anchor="start"))
    parts.append('<rect x="538" y="512" width="14" height="14" fill="#059669"/>')
    parts.append(text(560, legend_y + 13, "500 x 500 bars use class colors", 13, anchor="start"))
    parts.append("</svg>\n")
    (results / "task3_baseline_class_comparison.svg").write_text("\n".join(parts))


def render_noise_sensitivity(results):
    counts = load_noise_changes(results / "task3_noise_class_changes.csv")
    width = 980
    height = 540
    margin = {"top": 76, "right": 36, "bottom": 96, "left": 76}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_count = 60
    noises = list(counts.keys())
    x_gap = plot_w / (len(noises) - 1)
    y_base = margin["top"] + plot_h
    points = []
    for index, noise in enumerate(noises):
        x = margin["left"] + index * x_gap
        y = y_base - counts[noise] / max_count * plot_h
        points.append((x, y, noise, counts[noise]))

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        "<title id=\"title\">Noise Sensitivity of Rule Classifications</title>",
        "<desc id=\"desc\">Line chart of how many rules changed dominant classification relative to p equals zero.</desc>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        text(width / 2, 34, "Noise Sensitivity of Rule Classifications", 22, weight="700"),
        text(width / 2, 58, "Changed dominant class relative to the 500 x 500 p=0 baseline", 13),
        f'<rect x="{margin["left"]}" y="{margin["top"]}" width="{plot_w}" height="{plot_h}" fill="#ffffff" stroke="#d1d5db"/>',
    ]
    for tick in range(0, max_count + 1, 10):
        y = y_base - tick / max_count * plot_h
        parts.append(f'<line x1="{margin["left"]}" y1="{y:.1f}" x2="{margin["left"] + plot_w}" y2="{y:.1f}" stroke="#e5e7eb"/>')
        parts.append(text(margin["left"] - 12, y + 4, tick, 12, anchor="end"))

    path_d = " ".join(("M" if index == 0 else "L") + f"{x:.1f},{y:.1f}" for index, (x, y, _, _) in enumerate(points))
    parts.append(f'<path d="{path_d}" fill="none" stroke="#dc2626" stroke-width="3"/>')
    for x, y, noise, value in points:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#dc2626"><title>p={esc(noise)}: {value} changed rules</title></circle>')
        parts.append(text(x, y - 11, value, 11))
        label = "1.0" if noise == "1.000" else noise.rstrip("0").rstrip(".")
        parts.append(text(x, y_base + 24, label, 12))
    parts.append(text(margin["left"] + plot_w / 2, height - 28, "Noise probability p", 14, weight="700"))
    parts.append(text(22, margin["top"] + plot_h / 2, "Rules changed", 14, weight="700", rotate=-90))
    parts.append("</svg>\n")
    (results / "task3_noise_sensitivity.svg").write_text("\n".join(parts))


def main():
    results = Path(__file__).resolve().parents[1] / "results"
    render_baseline_comparison(results)
    render_noise_sensitivity(results)
    print(f"Wrote {results / 'task3_baseline_class_comparison.svg'}")
    print(f"Wrote {results / 'task3_noise_sensitivity.svg'}")


if __name__ == "__main__":
    main()
