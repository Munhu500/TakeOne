"""Draws the demo assets (illustrated creator, lifestyle scene, product shots). Run via `pnpm samples`. Needs Pillow."""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'products'), exist_ok=True)
S = 2  # supersample
W, H = 720 * S, 1280 * S

def font(size, bold=True):
    for p in ['/usr/share/fonts/opentype/inter/Inter-Bold.otf' if bold else '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def bottle(d, cx, top, w, h, label1, label2, glass=(214, 132, 38), cap=(32, 32, 36)):
    d.rounded_rectangle([cx - w * 0.22, top, cx + w * 0.22, top + h * 0.2], radius=8 * S, fill=cap)
    d.rounded_rectangle([cx - w / 2, top + h * 0.18, cx + w / 2, top + h], radius=20 * S, fill=glass)
    d.rounded_rectangle([cx - w * 0.4, top + h * 0.42, cx + w * 0.4, top + h * 0.86], radius=6 * S, fill=(250, 248, 244))
    f1, f2 = font(int(w * 0.13)), font(int(w * 0.085), False)
    d.text((cx, top + h * 0.56), label1, font=f1, fill=(30, 30, 34), anchor='mm')
    d.text((cx, top + h * 0.72), label2, font=f2, fill=(90, 90, 96), anchor='mm')

def creator(mouth_open):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    skin, hair, top = (224, 172, 132), (38, 26, 24), (124, 92, 255)
    cx = W // 2
    d.ellipse([cx - 250 * S, 250 * S, cx + 250 * S, 900 * S], fill=hair)                       # hair back
    d.rounded_rectangle([cx - 300 * S, 800 * S, cx + 300 * S, H + 80 * S], radius=150 * S, fill=top)  # torso
    d.rounded_rectangle([cx - 60 * S, 640 * S, cx + 60 * S, 850 * S], radius=40 * S, fill=(206, 152, 114))  # neck
    d.ellipse([cx - 110 * S, 790 * S, cx + 110 * S, 900 * S], fill=skin)                        # neckline
    d.ellipse([cx - 170 * S, 300 * S, cx + 170 * S, 720 * S], fill=skin)                        # face
    d.pieslice([cx - 185 * S, 270 * S, cx + 185 * S, 640 * S], 180, 360, fill=hair)             # fringe
    for ex in (-70, 70):
        d.ellipse([cx + (ex - 17) * S, 480 * S, cx + (ex + 17) * S, 514 * S], fill=(40, 28, 26))
        d.arc([cx + (ex - 36) * S, 430 * S, cx + (ex + 36) * S, 480 * S], 200, 340, fill=hair, width=7 * S)
    d.ellipse([cx - 150 * S, 540 * S, cx - 80 * S, 590 * S], fill=(236, 150, 130))
    d.ellipse([cx + 80 * S, 540 * S, cx + 150 * S, 590 * S], fill=(236, 150, 130))
    if mouth_open:
        d.ellipse([cx - 38 * S, 600 * S, cx + 38 * S, 656 * S], fill=(120, 40, 50))
        d.ellipse([cx - 24 * S, 630 * S, cx + 24 * S, 656 * S], fill=(210, 100, 110))
    else:
        d.arc([cx - 46 * S, 580 * S, cx + 46 * S, 640 * S], 20, 160, fill=(150, 60, 70), width=9 * S)
    # raised arm + hand holding the product (the product itself is never altered by any edit)
    d.line([(cx + 260 * S, 1230 * S), (cx + 215 * S, 1010 * S)], fill=top, width=120 * S)
    bottle(d, cx + 200 * S, 700 * S, 150 * S, 300 * S, 'KAYA', 'Vitamin C')
    d.ellipse([cx + 130 * S, 900 * S, cx + 280 * S, 1040 * S], fill=skin)
    for i in range(4):
        d.rounded_rectangle([cx + (118 + i * 4) * S, (910 + i * 30) * S, cx + 190 * S, (938 + i * 30) * S], radius=14 * S, fill=(214, 160, 122))
    return im.resize((720, 1280), Image.LANCZOS)

creator(False).save(os.path.join(OUT, 'creator_closed.png'))
creator(True).save(os.path.join(OUT, 'creator_open.png'))

# "AI scene" stand-in used by the mock scene provider: a bright morning room
sc = Image.new('RGB', (W, H), (246, 236, 220))
d = ImageDraw.Draw(sc)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(250 - 30 * t), int(238 - 34 * t), int(222 - 44 * t)))
d.rounded_rectangle([60 * S, 120 * S, 330 * S, 620 * S], radius=14 * S, fill=(188, 222, 244))            # window
d.line([(195 * S, 120 * S), (195 * S, 620 * S)], fill=(250, 248, 244), width=12 * S)
d.line([(60 * S, 370 * S), (330 * S, 370 * S)], fill=(250, 248, 244), width=12 * S)
d.ellipse([230 * S, 160 * S, 310 * S, 240 * S], fill=(255, 226, 150))
d.rectangle([0, 980 * S, W, H], fill=(206, 170, 130))                                                  # counter
d.rectangle([0, 960 * S, W, 990 * S], fill=(226, 196, 160))
d.rounded_rectangle([470 * S, 240 * S, 690 * S, 300 * S], radius=6 * S, fill=(160, 120, 86))            # shelf
for i, c in enumerate([(124, 92, 255), (240, 180, 90), (120, 180, 150)]):
    d.rounded_rectangle([(490 + i * 62) * S, 160 * S, (536 + i * 62) * S, 240 * S], radius=8 * S, fill=c)
d.rounded_rectangle([520 * S, 800 * S, 610 * S, 960 * S], radius=14 * S, fill=(150, 110, 80))            # plant pot
for a in range(-3, 4):
    d.ellipse([(545 + a * 34) * S, (640 - abs(a) * -22) * S, (600 + a * 34) * S, 830 * S], fill=(70, 140 + a * 6, 96))
sc.filter(ImageFilter.GaussianBlur(5 * S)).resize((720, 1280), Image.LANCZOS).save(os.path.join(OUT, 'scene_morning.jpg'), quality=90)

PRODUCTS = {
    'serum': ('KAYA', 'Vitamin C', (214, 132, 38), ((255, 226, 180), (250, 160, 90))),
    'sunscreen': ('KAYA', 'SPF 50', (250, 250, 246), ((180, 222, 255), (255, 214, 140))),
    'chai': ('CHAI & CO', 'Masala', (150, 76, 40), ((250, 222, 180), (196, 120, 70))),
    'coldbrew': ('CHAI & CO', 'Cold Brew', (60, 44, 40), ((190, 230, 220), (90, 150, 150))),
    'shoes': ('DUNE', 'Sandstorm', (240, 120, 70), ((250, 226, 190), (226, 160, 110))),
    'bar': ('DUNE', 'Date Bar', (110, 70, 44), ((240, 226, 200), (190, 150, 110))),
    'earbuds': ('SOUK', 'Falcon Pro', (36, 38, 46), ((200, 210, 240), (110, 120, 190))),
    'dock': ('SOUK', 'MagCharge', (220, 222, 228), ((60, 64, 90), (20, 22, 34))),
    'mist': ('NOOR', 'Oud Rose', (226, 150, 170), ((255, 226, 232), (214, 130, 150))),
    'moisturiser': ('NOOR', 'Desert Dew', (236, 240, 244), ((214, 236, 240), (150, 200, 210))),
    'coord': ('VEDA', 'Handloom', (190, 70, 90), ((250, 232, 214), (224, 170, 130))),
    'retinol': ('KAYA', 'Retinol', (90, 60, 130), ((230, 220, 250), (150, 120, 220))),
}
for slug, (l1, l2, col, (g1, g2)) in PRODUCTS.items():
    w, h = 800 * S, 1000 * S
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(g1[i] + (g2[i] - g1[i]) * t) for i in range(3)))
    d.ellipse([w * 0.2, h * 0.8, w * 0.8, h * 0.9], fill=tuple(max(0, c - 40) for c in g2))
    dark = sum(col) < 300
    bottle(d, w // 2, int(h * 0.22), int(w * 0.36), int(h * 0.62), l1, l2, glass=col, cap=(240, 240, 240) if dark else (32, 32, 36))
    im.resize((800, 1000), Image.LANCZOS).save(os.path.join(OUT, 'products', f'{slug}.jpg'), quality=88)
print('assets written to', OUT)
