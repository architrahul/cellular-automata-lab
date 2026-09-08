#!/usr/bin/env python3
import csv
import html
from collections import Counter, defaultdict
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


def load_counts(summary_path):
    by_noise = defaultdict(Counter)
    with summary_path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            by_noise[row["noise"]][row["dominantClass"]] += 1
    return dict(sorted(by_noise.items(), key=lambda item: float(item[0])))


def write_counts_csv(counts, output_path):
    with output_path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["noise", *CLASSES, "total"])
        for noise, class_counts in counts.items():
            row = [noise]
            total = 0
            for class_name in CLASSES:
                value = class_counts[class_name]
                row.append(value)
                total += value
            row.append(total)
            writer.writerow(row)


def svg_text(x, y, text, size=13, anchor="middle", weight="400", rotate=None):
    transform = f' transform="rotate({rotate} {x} {y})"' if rotate else ""
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" '
        f'font-weight="{weight}" text-anchor="{anchor}" fill="#111827"{transform}>'
        f"{html.escape(text)}</text>"
    )


def render_svg(counts, output_path):
    width = 1320
    height = 760
    margin = {"top": 74, "right": 34, "bottom": 128, "left": 78}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]
    max_count = 100
    noises = list(counts.keys())
    group_w = plot_w / len(noises)
    inner_gap = 8
    bar_gap = 2
    bar_w = (group_w - inner_gap * 2 - bar_gap * (len(CLASSES) - 1)) / len(CLASSES)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        '<title id="title">Rule Classification Across Noise Probabilities</title>',
        '<desc id="desc">Grouped histogram of dominant cellular automata rule classes for 100 rules at noise probabilities from 0 to 1.</desc>',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        svg_text(width / 2, 34, "Rule Classification Across Noise Probabilities", 22, weight="700"),
        svg_text(width / 2, 58, "100 rules, 500 x 500 grid, 500 generations, one controlled initial condition per rule", 13),
    ]

    x0 = margin["left"]
    y0 = margin["top"]
    y_base = y0 + plot_h
    parts.append(f'<rect x="{x0}" y="{y0}" width="{plot_w}" height="{plot_h}" fill="#ffffff" stroke="#d1d5db"/>')

    for tick in range(0, max_count + 1, 20):
        y = y_base - (tick / max_count) * plot_h
        parts.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x0 + plot_w}" y2="{y:.1f}" stroke="#e5e7eb"/>')
        parts.append(svg_text(x0 - 12, y + 4, str(tick), 12, anchor="end"))

    for noise_index, noise in enumerate(noises):
        group_x = x0 + noise_index * group_w
        for class_index, class_name in enumerate(CLASSES):
            value = counts[noise][class_name]
            bar_h = (value / max_count) * plot_h
            x = group_x + inner_gap + class_index * (bar_w + bar_gap)
            y = y_base - bar_h
            parts.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bar_h:.1f}" '
                f'fill="{COLORS[class_name]}">'
                f'<title>p={html.escape(noise)}, {html.escape(class_name)}: {value} rules</title>'
                "</rect>"
            )
        label = "1.0" if noise == "1.000" else ("0" if noise == "0.000" else noise.rstrip("0").rstrip("."))
        parts.append(svg_text(group_x + group_w / 2, y_base + 24, label, 12))

    parts.append(f'<line x1="{x0}" y1="{y_base}" x2="{x0 + plot_w}" y2="{y_base}" stroke="#111827"/>')
    parts.append(f'<line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y_base}" stroke="#111827"/>')
    parts.append(svg_text(x0 + plot_w / 2, height - 34, "Noise probability p", 14, weight="700"))
    parts.append(svg_text(22, y0 + plot_h / 2, "Number of rules", 14, weight="700", rotate=-90))

    legend_x = x0
    legend_y = height - 92
    legend_gap = 178
    for index, class_name in enumerate(CLASSES):
        row = index // 4
        col = index % 4
        lx = legend_x + col * legend_gap
        ly = legend_y + row * 28
        parts.append(f'<rect x="{lx}" y="{ly - 11}" width="14" height="14" fill="{COLORS[class_name]}"/>')
        parts.append(svg_text(lx + 22, ly + 1, class_name, 13, anchor="start"))

    parts.append("</svg>\n")
    output_path.write_text("\n".join(parts))


def main():
    root = Path(__file__).resolve().parents[1]
    results = root / "results"
    summary_path = results / "task3_500_noise_rule_summary.csv"
    counts_path = results / "task3_noise_class_counts.csv"
    svg_path = results / "task3_noise_classification_histogram.svg"

    counts = load_counts(summary_path)
    write_counts_csv(counts, counts_path)
    render_svg(counts, svg_path)
    print(f"Wrote {counts_path}")
    print(f"Wrote {svg_path}")


if __name__ == "__main__":
    main()
