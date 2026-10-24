"""Social share card (1200x630) for link previews: WhatsApp, Facebook, X, Google.

Brand "28 · Aurora" (src/theme/tokens.ts, src/components/brand/Brand.tsx): the cool
ground (#F6F9F9) lit by soft mint / violet / cyan blobs, the NÜVA wordmark in Sora
Bold, ink text, a teal accent, and white cards with soft ink shadows (like the
mockup's hero). Run from the repo root:
    python scripts/generate-og.py
Writes public/og.png (share card) and public/logo.png (512x512 app icon, used as the
Organization logo in the structured data).
"""
import importlib.util
import io
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, K = 1200, 630, 2  # drawn at 2x, then downscaled for smooth edges
GROUND, INK, INK_SOFT, MUTED, WHITE = (246, 249, 249), (14, 27, 36), (60, 75, 85), (78, 93, 102), (255, 255, 255)
TEAL, TEAL_INK, TEAL_SOFT, VIOLET, VIOLET_SOFT = (14, 124, 116), (11, 95, 89), (221, 245, 241), (91, 75, 214), (238, 234, 253)
MINT, LILAC, CYAN, INSET, LINE = (123, 224, 196), (169, 155, 245), (94, 209, 224), (242, 246, 247), (220, 227, 230)
FONTS = 'node_modules/@expo-google-fonts/sora'
# Read as bytes: FreeType can't open paths with non-ASCII characters ("PROJECT NÜVA") on Windows.
font = lambda weight, px: ImageFont.truetype(io.BytesIO(open(f'{FONTS}/{weight}/Sora_{weight}.ttf', 'rb').read()), round(px * K))
bold = lambda px: font('700Bold', px)
semi = lambda px: font('600SemiBold', px)
reg = lambda px: font('400Regular', px)


def blob(img, box, color, opacity, blur):
    """A blurred aurora blob (box in 1x px)."""
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse([v * K for v in box], fill=round(255 * opacity))
    mask = mask.filter(ImageFilter.GaussianBlur(blur * K))
    img.alpha_composite(Image.merge('RGBA', (*[Image.new('L', img.size, c) for c in color], mask)))


def card(img, box, radius, shadow=(0, 14, 30, 0.08)):
    """White card with a soft ink shadow (dx, dy, blur, alpha)."""
    x0, y0, x1, y1 = box
    dx, dy, blur, a = shadow
    sh = Image.new('L', img.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([(x0 + dx) * K, (y0 + dy) * K, (x1 + dx) * K, (y1 + dy) * K], radius=radius * K, fill=round(255 * a * 2.2))
    sh = sh.filter(ImageFilter.GaussianBlur(blur * K / 2))
    img.alpha_composite(Image.merge('RGBA', (*[Image.new('L', img.size, c) for c in INK], sh)))
    ImageDraw.Draw(img).rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=radius * K, fill=WHITE)


def tracked(d, xy, text, f, fill, spacing):
    """Text with letter spacing (1x px)."""
    x, y = xy
    for ch in text:
        d.text((x * K, y * K), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) / K + spacing


def pill(d, x, y, text, f, fg, bg, pad=(12, 6), dot=None):
    """Rounded chip; returns its right edge (1x px)."""
    tw = d.textlength(text, font=f) / K
    _, ty0, _, ty1 = d.textbbox((0, 0), text, font=f)
    th = (ty1 - ty0) / K
    extra = 16 if dot else 0
    w, h = tw + pad[0] * 2 + extra, th + pad[1] * 2 + 4
    d.rounded_rectangle([x * K, y * K, (x + w) * K, (y + h) * K], radius=h * K / 2, fill=bg)
    if dot:
        cy = y + h / 2
        d.ellipse([(x + pad[0]) * K, (cy - 4) * K, (x + pad[0] + 8) * K, (cy + 4) * K], fill=dot)
    d.text(((x + pad[0] + extra) * K, (y + pad[1] + 2) * K - ty0), text, font=f, fill=fg)
    return x + w


img = Image.new('RGBA', (W * K, H * K), (*GROUND, 255))
# Aurora: mint top-left, violet right, cyan bottom (mockup layout, scaled to the card).
blob(img, (-140, -170, 420, 300), MINT, 0.75, 80)
blob(img, (760, 60, 1280, 480), LILAC, 0.6, 90)
blob(img, (300, 470, 860, 800), CYAN, 0.5, 90)
d = ImageDraw.Draw(img)

# ── Left: brand + message ─────────────────────────────────────────────
x = 72
tracked(d, (x, 58), 'NÜVA', bold(30), INK, 3)
pill(d, x, 158, 'Pereira · Dosquebradas', semi(17), INK, (255, 255, 255, 230), pad=(16, 8), dot=TEAL)
d.text((x * K, 222 * K), 'Tu ciudad.', font=bold(60), fill=INK)
d.text((x * K, 294 * K), 'Tu ritmo.', font=bold(60), fill=INK)
d.text((x * K, 366 * K), 'Tu precio.', font=bold(60), fill=TEAL_INK)
d.text((x * K, 470 * K), 'Taxi y viajes en Pereira y Dosquebradas.', font=reg(22), fill=INK_SOFT)
d.text((x * K, 504 * K), 'Ves cuánto cuesta y quién te recoge.', font=reg(22), fill=INK_SOFT)
r = pill(d, x, 556, 'nuva.expo.app', semi(18), WHITE, TEAL, pad=(18, 9))

# ── Right: white cards (mockup hero) ──────────────────────────────────
cx0, cx1 = 690, 1140
card(img, (cx0, 120, cx1, 330), 26, (0, 18, 40, 0.08))
d = ImageDraw.Draw(img)
d.text(((cx0 + 26) * K, 144 * K), 'Precio antes de pedir', font=semi(16), fill=MUTED)
tw = d.textlength('Tráfico en vivo', font=semi(14)) / K
pill(d, cx1 - 26 - tw - 24, 140, 'Tráfico en vivo', semi(14), TEAL_INK, TEAL_SOFT, pad=(12, 5))
# Route: ink ring → arrow → violet square.
ry = 196
d.ellipse([(cx0 + 26) * K, (ry - 8) * K, (cx0 + 42) * K, (ry + 8) * K], outline=INK, width=4 * K)
d.text(((cx0 + 54) * K, (ry - 13) * K), 'Origen', font=semi(19), fill=INK)
ax = cx0 + 54 + d.textlength('Origen', font=semi(19)) / K + 14
d.line([(ax * K, ry * K), ((ax + 40) * K, ry * K)], fill=(154, 167, 175), width=3 * K)
d.line([((ax + 32) * K, (ry - 7) * K), ((ax + 40) * K, ry * K), ((ax + 32) * K, (ry + 7) * K)], fill=(154, 167, 175), width=3 * K, joint='curve')
d.rounded_rectangle([(ax + 54) * K, (ry - 8) * K, (ax + 70) * K, (ry + 8) * K], radius=4 * K, fill=VIOLET)
d.text(((ax + 80) * K, (ry - 13) * K), 'Destino', font=semi(19), fill=INK)
d.text(((cx0 + 26) * K, 232 * K), 'Con su desglose', font=bold(40), fill=INK)
# Breakdown strip (inset panel).
d.rounded_rectangle([(cx0 + 26) * K, 290 * K, (cx1 - 26) * K, 314 * K], radius=12 * K, fill=INSET)
d.text(((cx0 + 40) * K, 294 * K), 'Banderazo  +  km  +  minutos', font=reg(14), fill=INK_SOFT)

# Two small cards.
card(img, (cx0, 352, 908, 520), 22, (0, 12, 30, 0.07))
card(img, (922, 352, cx1, 520), 22, (0, 12, 30, 0.07))
d = ImageDraw.Draw(img)
d.text(((cx0 + 20) * K, 374 * K), 'PIN de abordaje', font=semi(15), fill=MUTED)
tracked(d, (cx0 + 20, 398), '4827', bold(36), INK, 6)
d.text(((cx0 + 20) * K, 470 * K), 'Se lo dices al subir', font=reg(14), fill=MUTED)
d.rounded_rectangle([942 * K, 372 * K, 978 * K, 408 * K], radius=12 * K, fill=VIOLET_SOFT)
d.rounded_rectangle([950 * K, 381 * K, 970 * K, 399 * K], radius=4 * K, outline=VIOLET, width=3 * K)
d.line([(950 * K, 387 * K), (970 * K, 387 * K)], fill=VIOLET, width=3 * K)
d.text((942 * K, 424 * K), 'Pagos', font=bold(19), fill=INK)
d.text((942 * K, 454 * K), 'Efectivo, Nequi,', font=reg(14), fill=MUTED)
d.text((942 * K, 474 * K), 'Daviplata o tarjeta', font=reg(14), fill=MUTED)

img.convert('RGB').resize((W, H), Image.LANCZOS).save('public/og.png', optimize=True)
print('public/og.png', W, 'x', H)

# Logo: the app icon (the aurora tile with an ink "N"), drawn by the icon generator.
spec = importlib.util.spec_from_file_location('icons', os.path.join(os.path.dirname(__file__), 'generate-icons.py'))
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)
icons.render(512).convert('RGB').save('public/logo.png', optimize=True)
print('public/logo.png', 512, 'x', 512)
