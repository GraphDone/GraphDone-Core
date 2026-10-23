#!/usr/bin/env python3
"""OpenCV screen-balance / layout metrics for a graph-canvas screenshot.

Given an image (ideally already cropped to the graph drawing area), it isolates
the rendered graph content from the calm gradient background via edge density
(robust to a smooth background), then reports OBJECTIVE numeric measurements of
how the content is placed and how much of the canvas it uses:

  centroid offset from center, bounding-box coverage, content pixel usage,
  left/right & top/bottom margin balance, quadrant mass distribution, and a
  single informational balanceScore (0-100, higher = better-centered/balanced).

These are measurements, not verdicts — thresholds/pass-fail live in the caller
(Playwright / the live audit), so the same numbers can drive reports first and
gates later.

Usage:
  python3 balance_metrics.py <image> [--annotate <out.jpg>]
Prints a JSON object to stdout.
"""
import json
import sys

import cv2
import numpy as np

MAX_QUAD_STD = 0.4330  # std of [1,0,0,0] — all mass in one quadrant (worst case)


def measure(path, annotate=None, force="auto"):
    img = cv2.imread(path)
    if img is None:
        return {"error": f"could not read {path}"}
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Background sampled from a thin border ring. If it's near-uniform (the flat
    # high-contrast "audit" theme), detect content by COLOUR DISTANCE from it —
    # accurate for solid node fills, not just edges. Otherwise fall back to edge
    # density, which is robust against a gradient/textured background.
    ring = np.concatenate([
        img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3),
        img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3),
    ]).astype(np.int16)
    bg = np.median(ring, axis=0)
    flat = float(ring.std(axis=0).mean()) < 12.0
    if force == "edge":
        flat = False
    elif force == "flat":
        flat = True
    if flat:
        diff = np.abs(img.astype(np.int16) - bg).max(axis=2).astype(np.uint8)
        mask = ((diff > 28) * 255).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    else:
        edges = cv2.Canny(gray, 50, 140)
        mask = cv2.dilate(edges, np.ones((9, 9), np.uint8), iterations=2)
    ys, xs = np.where(mask > 0)

    out = {"image": path, "w": w, "h": h, "method": "flat" if flat else "edge", "contentPixels": int(len(xs))}
    if len(xs) < 200:  # effectively empty canvas
        out.update({"empty": True, "balanceScore": None})
        return out

    cx, cy = float(xs.mean()), float(ys.mean())
    off_x = (cx - w / 2) / (w / 2)
    off_y = (cy - h / 2) / (h / 2)
    off_mag = float((off_x ** 2 + off_y ** 2) ** 0.5)

    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    bw, bh = x1 - x0, y1 - y0
    coverage = (bw * bh) / (w * h)            # bbox area / canvas area
    usage = len(xs) / (w * h)                 # actual content pixels / canvas
    fill = len(xs) / max(1, bw * bh)          # content density within its bbox

    left, right, top, bottom = x0, w - 1 - x1, y0, h - 1 - y1
    bal_x = abs(left - right) / max(1, left + right)
    bal_y = abs(top - bottom) / max(1, top + bottom)

    q = [
        int(((xs < w / 2) & (ys < h / 2)).sum()),   # tl
        int(((xs >= w / 2) & (ys < h / 2)).sum()),  # tr
        int(((xs < w / 2) & (ys >= h / 2)).sum()),  # bl
        int(((xs >= w / 2) & (ys >= h / 2)).sum()),  # br
    ]
    qf = [v / len(xs) for v in q]
    quad_imbalance = float(np.std(qf))

    center_pen = min(1.0, off_mag)
    margin_pen = (bal_x + bal_y) / 2
    quad_pen = min(1.0, quad_imbalance / MAX_QUAD_STD)
    score = round(100 * max(0.0, 1 - 0.45 * center_pen - 0.30 * margin_pen - 0.25 * quad_pen))

    out.update({
        "contentFrac": round(usage, 4),
        "centroid": {"x": round(cx, 1), "y": round(cy, 1),
                     "offX": round(off_x, 3), "offY": round(off_y, 3), "offMag": round(off_mag, 3)},
        "bbox": {"x": x0, "y": y0, "w": bw, "h": bh,
                 "coverage": round(coverage, 4), "fill": round(fill, 3)},
        "margins": {"left": left, "right": right, "top": top, "bottom": bottom,
                    "balanceX": round(bal_x, 3), "balanceY": round(bal_y, 3)},
        "quadrants": {"tl": round(qf[0], 3), "tr": round(qf[1], 3),
                      "bl": round(qf[2], 3), "br": round(qf[3], 3),
                      "imbalance": round(quad_imbalance, 3)},
        "balanceScore": score,
    })

    if annotate:
        vis = img.copy()
        cv2.rectangle(vis, (x0, y0), (x1, y1), (80, 200, 80), 2)               # content bbox (green)
        cv2.drawMarker(vis, (int(cx), int(cy)), (80, 80, 240), cv2.MARKER_CROSS, 26, 3)  # centroid (red)
        cv2.drawMarker(vis, (w // 2, h // 2), (240, 200, 80), cv2.MARKER_TILTED_CROSS, 22, 2)  # frame center (blue)
        cv2.line(vis, (w // 2, 0), (w // 2, h), (90, 90, 90), 1)
        cv2.line(vis, (0, h // 2), (w, h // 2), (90, 90, 90), 1)
        label = f"score {score} | off {off_mag:.2f} | use {usage*100:.0f}% | quad {quad_imbalance:.2f}"
        cv2.rectangle(vis, (0, 0), (max(360, 9 * len(label)), 26), (20, 20, 20), -1)
        cv2.putText(vis, label, (8, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (240, 240, 240), 1, cv2.LINE_AA)
        cv2.imwrite(annotate, vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
        out["annotated"] = annotate

    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: balance_metrics.py <image> [--annotate <out.jpg>]"}))
        sys.exit(2)
    ann = None
    if "--annotate" in sys.argv:
        ann = sys.argv[sys.argv.index("--annotate") + 1]
    force = "flat" if "--flat" in sys.argv else "edge" if "--edge" in sys.argv else "auto"
    print(json.dumps(measure(sys.argv[1], ann, force)))
