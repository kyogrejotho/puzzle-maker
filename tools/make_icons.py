"""Draws the app icon (a cream puzzle piece with a flower on rose) at the sizes phones need.

Run from anywhere:  python tools/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
BG = "#b8456b"
PIECE = "#fbf3e6"
PETAL = "#e88aa6"
CENTER = "#f2c14e"


def draw(size=1024):
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size / 1024
    r = 92 * s
    # Piece body, shifted so body + knobs sit in the middle of the icon.
    x0, y0 = 252 * s, 380 * s
    x1, y1 = x0 + 420 * s, y0 + 420 * s
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    d.rounded_rectangle([x0, y0, x1, y1], radius=36 * s, fill=PIECE)
    d.ellipse([cx - r, y0 - r * 1.6, cx + r, y0 + r * 0.4], fill=PIECE)  # knob on top
    d.ellipse([x1 - r * 0.4, cy - r, x1 + r * 1.6, cy + r], fill=PIECE)  # knob on the right
    h = r * 0.8
    d.ellipse([x0 - h * 0.7, cy - h, x0 + h * 1.3, cy + h], fill=BG)  # hole on the left
    d.ellipse([cx - h, y1 - h * 1.3, cx + h, y1 + h * 0.7], fill=BG)  # hole at the bottom

    # A little flower on the piece.
    fx, fy, pr = cx + 10 * s, cy - 10 * s, 46 * s
    for dx, dy in [(0, -1), (0.95, -0.31), (0.59, 0.81), (-0.59, 0.81), (-0.95, -0.31)]:
        px, py = fx + dx * pr * 1.25, fy + dy * pr * 1.25
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=PETAL)
    d.ellipse([fx - pr * 0.8, fy - pr * 0.8, fx + pr * 0.8, fy + pr * 0.8], fill=CENTER)
    return img


def main():
    OUT.mkdir(exist_ok=True)
    big = draw(1024)
    for name, px in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
        big.resize((px, px), Image.LANCZOS).save(OUT / name)
        print("wrote", OUT / name)


if __name__ == "__main__":
    main()
