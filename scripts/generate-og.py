"""Social share card (1200x630) for link previews: WhatsApp, Facebook, X, Google.

Draws the NÜVA wordmark from the same geometry as WORDMARK_PATHS / WORDMARK in
src/components/brand/Brand.tsx (N, U, V, Λ; the umlaut is a route: hollow origin
ring + solid lime destination dot) and the tagline in Manrope. Run from the repo root:
    python scripts/generate-og.py
Writes public/og.png (share card) and public/logo.png (512x512 app icon, used as the
Organization logo in the structured data).
"""
import io
import math

from PIL import Image, ImageDraw, ImageFont

W, H, K = 1200, 630, 2  # drawn at 2x, then downscaled for smooth edges
MIDNIGHT, LIME, IVORY, MUTED, LINE = (16, 20, 17), (212, 255, 95), (245, 246, 240), (157, 162, 155), (42, 49, 43)
FONTS = 'node_modules/@expo-google-fonts/manrope'
# Read as bytes: FreeType can't open paths with non-ASCII characters ("PROJECT NÜVA") on Windows.
font = lambda weight, px: ImageFont.truetype(io.BytesIO(open(f'{FONTS}/{weight}/Manrope_{weight}.ttf', 'rb').read()), round(px * K))
bold = lambda px: font('700Bold', px)
semi = lambda px: font('600SemiBold', px)


def arc(cx, cy, r, a0, a1, steps=48):
    """Points on a circle (degrees, y down), from a0 to a1."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / steps)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]


# Letters on the 100-unit cap height (viewBox x 0..368, y -38..100).
LETTERS = [
    [(0, 0), (17, 0), (64, 72), (64, 0), (80, 0), (80, 100), (63, 100), (16, 28), (16, 100), (0, 100)],
    # U: inner arc r24 and outer arc r40 around (134, 60), both through the bottom.
    [(94, 0), (110, 0), (110, 60), *arc(134, 60, 24, 180, 0), (158, 0), (174, 0), (174, 60), *arc(134, 60, 40, 0, 180)],
    [(188, 0), (205, 0), (230, 76), (255, 0), (272, 0), (240, 100), (220, 100)],
    [(316, 0), (336, 0), (368, 100), (351, 100), (326, 22), (301, 100), (284, 100)],
]


def wordmark(d, x0, y0, s, color=IVORY, accent=LIME):
    """Wordmark with its viewBox top-left (0, -38) at (x0, y0), s px per unit."""
    p = lambda x, y: (x0 + x * s, y0 + (y + 38) * s)
    for pts in LETTERS:
        d.polygon([p(x, y) for x, y in pts], fill=color)
    ox, oy, r = p(102, -22) + (9 * s,)
    d.ellipse([ox - r, oy - r, ox + r, oy + r], outline=color, width=round(5 * s))
    dx, dy, r = p(166, -22) + (10.5 * s,)
    d.ellipse([dx - r, dy - r, dx + r, dy + r], fill=accent)


def rings(d, cx, cy, scale):
    """BrandRings backdrop (src/components/brand/Brand.tsx), faint lime circles."""
    for i, r in enumerate((96, 76, 56, 36)):
        a = 0.14 * (1 - i * 0.18)
        c = tuple(round(MIDNIGHT[j] + (LIME[j] - MIDNIGHT[j]) * a) for j in range(3))
        rr = r * scale
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=c, width=max(2, round(0.6 * scale)))


img = Image.new('RGB', (W * K, H * K), MIDNIGHT)
d = ImageDraw.Draw(img)
rings(d, 1010 * K, 470 * K, 4.4 * K)

x = 96 * K
wordmark(d, x, 84 * K, 1.15 * K)  # 423 x 159 px
d.rectangle([(x, 282 * K), (x + 96 * K, 286 * K)], fill=LIME)
d.text((x, 318 * K), 'Tu ciudad. Tu ritmo.', font=bold(58), fill=IVORY)
d.text((x, 390 * K), 'Tu precio.', font=bold(58), fill=LIME)
d.text((x, 490 * K), 'Taxi y viajes en Pereira y Dosquebradas', font=semi(28), fill=IVORY)
d.text((x, 534 * K), 'Precio y desglose antes de pedir · nuva.expo.app', font=semi(24), fill=MUTED)

img.resize((W, H), Image.LANCZOS).save('public/og.png', optimize=True)
print('public/og.png', W, 'x', H)

# Logo: the app icon (AppIcon in Brand.tsx): the Ü alone on Midnight, 100-unit grid.
L = 512
logo = Image.new('RGB', (L * K, L * K), MIDNIGHT)
d = ImageDraw.Draw(logo)
u = L * K / 100
q = lambda x, y: (x * u, y * u)
icon_u = [(0, 0), (16, 0), (16, 60), *arc(40, 60, 24, 180, 0), (64, 0), (80, 0), (80, 60), *arc(40, 60, 40, 0, 180)]
d.polygon([q(30 + x * 0.5, 34 + y * 0.5) for x, y in icon_u], fill=IVORY)
cx, cy = q(34, 23)
r = 4.5 * u
d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=IVORY, width=round(2.5 * u))
cx, cy = q(66, 23)
r = 5.25 * u
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LIME)
logo.resize((L, L), Image.LANCZOS).save('public/logo.png', optimize=True)
print('public/logo.png', L, 'x', L)
