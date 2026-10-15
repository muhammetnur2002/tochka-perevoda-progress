#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генерация брендовых ассетов из исходного логотипа.

Запуск:
    python scripts/make-brand-assets.py "<путь к исходному jpg>" "<корень проекта>"

Создаёт:
    public/brand/logo-source.jpg   — копия исходника
    public/brand/logo.png          — полный логотип (обрезка белых полей)
    public/brand/logo-mark.png     — эмблема (круглый знак, без текста)
    public/brand/logo.svg          — векторный фолбэк с названием в брендовых цветах
    public/favicon.ico             — иконка 16/32/48/64
    src/app/icon.png               — 512x512 (Next.js file convention)
    src/app/apple-icon.png         — 180x180
    public/brand/tg-bot-avatar.png — 512x512 аватар бота
    public/brand/og-image.jpg      — 1200x630 Open Graph
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

NAVY = (0, 33, 76)          # #00214C
NAVY_LIGHT = (30, 90, 168)  # #1E5AA8
GOLD = (212, 160, 42)       # #D4A02A
GOLD_LIGHT = (232, 176, 63)  # #E8B03F
WHITE = (253, 253, 253)


def bbox_nonwhite(img, y0=0, y1=None, tol=235):
    """Bounding box всех пикселей, не являющихся почти белыми (в пределах [y0, y1))."""
    w, h = img.size
    if y1 is None:
        y1 = h
    px = img.load()
    left, top, right, bottom = w, h, -1, -1
    for y in range(max(0, y0), min(h, y1)):
        for x in range(w):
            r, g, b = px[x, y]
            if r < tol or g < tol or b < tol:
                if x < left:
                    left = x
                if x > right:
                    right = x
                if y < top:
                    top = y
                if y > bottom:
                    bottom = y
    return left, top, right, bottom


def pad_box(box, pad, img_size):
    w, h = img_size
    l, t, r, b = box
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(w - 1, r + pad)
    b = min(h - 1, b + pad)
    return l, t, r, b


def to_square(img, bg=WHITE):
    """Дополняет изображение белыми полями до квадрата."""
    w, h = img.size
    s = max(w, h)
    out = Image.new("RGB", (s, s), bg)
    out.paste(img, ((s - w) // 2, (s - h) // 2))
    return out


def load_font(size, bold=True):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/calibri.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def main():
    if len(sys.argv) < 3:
        print("usage: make-brand-assets.py <source.jpg> <project_root>")
        sys.exit(1)
    src = sys.argv[1]
    root = sys.argv[2]

    brand = os.path.join(root, "public", "brand")
    app = os.path.join(root, "src", "app")
    os.makedirs(brand, exist_ok=True)
    os.makedirs(app, exist_ok=True)

    im = Image.open(src).convert("RGB")
    w, h = im.size

    # 1) исходник
    im.save(os.path.join(brand, "logo-source.jpg"), quality=95)

    # 2) полный логотип (обрезка полей)
    full_box = bbox_nonwhite(im)
    full_pad = pad_box(full_box, 6, (w, h))
    logo = im.crop(full_pad)
    logo.save(os.path.join(brand, "logo.png"))

    # 3) эмблема (верхняя часть до текста; band подобрана по анализу: y 20..160)
    mark_box = bbox_nonwhite(im, y0=20, y1=160)
    mark_pad = pad_box(mark_box, 4, (w, h))
    mark = im.crop(mark_pad)
    mark.save(os.path.join(brand, "logo-mark.png"))

    # 4) favicon.ico из эмблемы
    sq = to_square(mark)
    sq.save(os.path.join(root, "public", "favicon.ico"),
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    # 5) icon.png (512) и apple-icon.png (180)
    sq.resize((512, 512), Image.LANCZOS).save(os.path.join(app, "icon.png"))
    sq.resize((180, 180), Image.LANCZOS).save(os.path.join(app, "apple-icon.png"))

    # 6) аватар бота: белый квадрат, эмблема по центру ~72%
    avatar = Image.new("RGB", (512, 512), WHITE)
    m = sq.resize((360, 360), Image.LANCZOS)
    avatar.paste(m, ((512 - 360) // 2, (512 - 360) // 2))
    avatar.save(os.path.join(brand, "tg-bot-avatar.png"))

    # 7) og-image.jpg 1200x630
    og = Image.new("RGB", (1200, 630), NAVY)
    d = ImageDraw.Draw(og)
    # белая карточка по центру
    card = (250, 80, 950, 420)
    d.rounded_rectangle(card, radius=28, fill=WHITE)
    logo_scaled = logo.copy()
    lw, lh = logo_scaled.size
    target_h = 240
    target_w = int(lw * target_h / lh)
    logo_scaled = logo_scaled.resize((target_w, target_h), Image.LANCZOS)
    og.paste(logo_scaled, ((1200 - target_w) // 2, (340 - target_h) // 2 + 80))
    f_gold = load_font(44)
    f_white = load_font(30, bold=False)
    d.text((600, 470), "Бюро переводов · Казань", font=f_gold,
           fill=GOLD_LIGHT, anchor="mm")
    d.text((600, 540), "ул. Сибирский Тракт, 7/6  ·  Переводы · Полиграфия · Страхование",
           font=f_white, fill=(230, 238, 250), anchor="mm")
    og.save(os.path.join(brand, "og-image.jpg"), quality=92)

    print("OK. full logo box:", full_pad, " mark box:", mark_pad)
    print("outputs written to", brand, "and", app)


if __name__ == "__main__":
    main()
