"""App icon, adaptive icon, splash and favicon — brand "28 · Aurora".

The aurora tile: the cool ground (#F6F9F9) lit by soft mint / violet / cyan blobs
(blurred), with an ink "N" in Sora Bold. Matches AppIcon / LogoMark in
src/components/brand/Brand.tsx. Run from the repo root:
    python scripts/generate-icons.py
Writes assets/icon.png, android-icon-{foreground,background,monochrome}.png,
splash-icon.png and favicon.png.
"""
import io

from PIL import Image, ImageDraw, ImageFilter, ImageFont

GROUND, INK, WHITE = (246, 249, 249), (14, 27, 36), (255, 255, 255)
MINT, VIOLET, CYAN = (123, 224, 196), (169, 155, 245), (94, 209, 224)
SS = 4  # supersampling for smooth edges
# Read as bytes: FreeType can't open paths with non-ASCII characters ("PROJECT NÜVA") on Windows.
FONT = open('node_modules/@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf', 'rb').read()

# Blobs in 0..100 tile units: centre, radii, colour, opacity (same layout as AuroraTileBg).
BLOBS = (
    ((18, 14), (44, 38), MINT, 0.95),
    ((96, 52), (36, 34), VIOLET, 0.85),
    ((42, 104), (42, 28), CYAN, 0.8),
)


def aurora(size, ground=True, shrink=1.0):
    """Aurora light on a `size` canvas. ground=False: blobs only, on transparency.
    `shrink` pulls the blobs towards the centre (< 1 keeps the canvas edges clear)."""
    img = Image.new('RGBA', (size, size), (*GROUND, 255) if ground else (0, 0, 0, 0))
    u = size / 100
    f = lambda v: 50 + (v - 50) * shrink
    for (cx, cy), (rx, ry), color, op in BLOBS:
        cx, cy, rx, ry = f(cx), f(cy), rx * shrink, ry * shrink
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([(cx - rx) * u, (cy - ry) * u, (cx + rx) * u, (cy + ry) * u], fill=round(255 * op))
        mask = mask.filter(ImageFilter.GaussianBlur(size * 0.12 * shrink))
        img.alpha_composite(Image.merge('RGBA', (*[Image.new('L', (size, size), c) for c in color], mask)))
    return img


def letter_n(img, k, fg):
    """Ink "N" centred, scaled by `k` (adaptive safe zone)."""
    size = img.size[0]
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(io.BytesIO(FONT), round(size * 0.54 * k))
    x0, y0, x1, y1 = d.textbbox((0, 0), 'N', font=font)
    d.text((size / 2 - (x0 + x1) / 2, size / 2 - (y0 + y1) / 2), 'N', font=font, fill=fg)
    return img


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=img.size[0] * radius, fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def render(size, *, light=True, ground=True, shrink=1.0, n=True, k=1.0, fg=INK, radius=None):
    """Draws at SS× and downsamples."""
    S = size * SS
    img = aurora(S, ground, shrink) if light else Image.new('RGBA', (S, S), (0, 0, 0, 0))
    if n:
        letter_n(img, k, fg)
    if radius:
        img = rounded(img, radius)
    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    img.save(path, optimize=True)
    print(path, img.size[0], 'x', img.size[1])


if __name__ == '__main__':
    # iOS / generic icon: full-bleed aurora tile (the OS applies its own mask).
    save(render(1024), 'assets/icon.png')
    # Android adaptive: aurora background layer, ink "N" inside the 66 % safe zone, monochrome (themed icons).
    save(render(1024, n=False), 'assets/android-icon-background.png')
    save(render(1024, light=False, k=0.72), 'assets/android-icon-foreground.png')
    save(render(1024, light=False, k=0.72, fg=WHITE), 'assets/android-icon-monochrome.png')
    # Splash (on the #F6F9F9 ground from app.json): the aurora light floating around the "N", no tile edge.
    save(render(1024, ground=False, shrink=0.5, k=0.6), 'assets/splash-icon.png')
    # Favicon: the rounded aurora tile.
    save(render(64, radius=0.23), 'assets/favicon.png')
