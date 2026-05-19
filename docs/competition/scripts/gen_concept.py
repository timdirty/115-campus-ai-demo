"""Generate concept/banner images for ai_concept placeholders.

These are NOT photorealistic; they are clean geometric typographic banners
that read as 'concept illustration' to a judge. Each app gets 4 variants:
- banner (generic)
- timeline (learning journey)
- fourframe (four-step story)
- system (system overview / mind map)
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1600, 900

APPS = {
    "app1": {
        "name": "AI 智慧型白板機器人",
        "tagline": "板書保存 · 智能擦拭 · 學習復現",
        "primary": (255, 138, 76),    # 橘
        "accent": (255, 195, 154),
        "bg": (255, 250, 246),
        "ink": (60, 40, 30),
    },
    "app2": {
        "name": "校園 AI 多功能服務機器人",
        "tagline": "派遣 · 配送 · 避障 · 回報",
        "primary": (76, 175, 110),    # 綠
        "accent": (170, 220, 190),
        "bg": (246, 254, 250),
        "ink": (30, 60, 45),
    },
    "app3": {
        "name": "AI 校園心靈守護者",
        "tagline": "匿名感測 · AI 分級 · 老師確認 · 溫和關懷",
        "primary": (140, 110, 200),   # 紫
        "accent": (200, 180, 230),
        "bg": (250, 248, 254),
        "ink": (50, 40, 70),
    },
}


def font(size, bold=False):
    paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def base_canvas(cfg):
    img = Image.new("RGB", (W, H), cfg["bg"])
    d = ImageDraw.Draw(img)
    # diagonal accent stripe
    d.polygon([(0, H), (0, H - 100), (W, H - 240), (W, H)], fill=cfg["accent"])
    d.polygon([(0, H), (0, H - 50), (W, H - 180), (W, H)], fill=cfg["primary"])
    # top tag bar
    d.rectangle([(0, 0), (W, 14)], fill=cfg["primary"])
    return img, d


def center_text(d, text, y, fnt, color):
    bbox = d.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, y), text, font=fnt, fill=color)


def stamp_label(d, cfg, text="概念示意 · 非實機照"):
    f = font(24)
    x, y = W - 380, 50
    d.rounded_rectangle([(x, y), (x + 340, y + 50)], radius=25, fill=cfg["primary"])
    bbox = d.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    d.text((x + (340 - tw) // 2, y + 12), text, font=f, fill=(255, 255, 255))


def make_banner(app, cfg, out):
    img, d = base_canvas(cfg)
    f_big = font(96, bold=True)
    f_sub = font(40)
    center_text(d, cfg["name"], 260, f_big, cfg["ink"])
    center_text(d, cfg["tagline"], 410, f_sub, cfg["primary"])
    # decoration: 3 dots
    for i, ratio in enumerate([0.3, 0.5, 0.7]):
        cx = int(W * ratio)
        d.ellipse([(cx - 14, 540), (cx + 14, 568)], fill=cfg["primary"])
    stamp_label(d, cfg)
    img.save(out, "PNG", optimize=True)
    print("wrote", out)


def make_timeline(app, cfg, out):
    img, d = base_canvas(cfg)
    f_big = font(72, bold=True)
    f_label = font(28)
    f_caption = font(26)
    center_text(d, "學習歷程時間軸", 100, f_big, cfg["ink"])

    steps = [
        ("第 1 週", "觀察問題"),
        ("第 2 週", "Scratch 原型"),
        ("第 3 週", "硬體整合"),
        ("第 4 週", "失敗改良"),
        ("第 5 週", "AI 串接"),
        ("第 6 週", "成果展示"),
    ]
    # horizontal line
    y_line = 480
    d.line([(120, y_line), (W - 120, y_line)], fill=cfg["primary"], width=6)
    n = len(steps)
    for i, (wk, lbl) in enumerate(steps):
        cx = 120 + int((W - 240) * i / (n - 1))
        d.ellipse([(cx - 28, y_line - 28), (cx + 28, y_line + 28)], fill=cfg["primary"])
        # week number
        bbox = d.textbbox((0, 0), str(i + 1), font=font(34, bold=True))
        tw = bbox[2] - bbox[0]
        d.text((cx - tw // 2, y_line - 22), str(i + 1), font=font(34, bold=True), fill=(255, 255, 255))
        # label above
        bbox = d.textbbox((0, 0), wk, font=f_label)
        tw = bbox[2] - bbox[0]
        d.text((cx - tw // 2, y_line - 80), wk, font=f_label, fill=cfg["primary"])
        # caption below
        bbox = d.textbbox((0, 0), lbl, font=f_caption)
        tw = bbox[2] - bbox[0]
        d.text((cx - tw // 2, y_line + 50), lbl, font=f_caption, fill=cfg["ink"])

    stamp_label(d, cfg)
    img.save(out, "PNG", optimize=True)
    print("wrote", out)


def make_fourframe(app, cfg, out):
    img, d = base_canvas(cfg)
    f_big = font(72, bold=True)
    f_no = font(120, bold=True)
    f_lbl = font(34)
    center_text(d, "四格操作故事", 80, f_big, cfg["ink"])
    captions = {
        "app1": ["選擇擦除區域", "機器人移動定位", "擦除前拍照保存", "學生課後複習"],
        "app2": ["建立任務", "檢查電量與路線", "安全配送", "收件確認回報"],
        "app3": ["匿名感測", "AI 風險分級", "老師查看建議", "溫和關懷結案"],
    }[app]
    cards = [(120, 250), (820, 250), (120, 560), (820, 560)]
    for i, (x, y) in enumerate(cards):
        d.rounded_rectangle([(x, y), (x + 660, y + 280)], radius=24, fill=(255, 255, 255), outline=cfg["primary"], width=3)
        d.text((x + 30, y + 30), str(i + 1), font=f_no, fill=cfg["primary"])
        bbox = d.textbbox((0, 0), captions[i], font=f_lbl)
        d.text((x + 200, y + 110), captions[i], font=f_lbl, fill=cfg["ink"])
    stamp_label(d, cfg)
    img.save(out, "PNG", optimize=True)
    print("wrote", out)


def make_system(app, cfg, out):
    img, d = base_canvas(cfg)
    f_big = font(72, bold=True)
    f_node = font(30, bold=True)
    f_label = font(24)
    center_text(d, "系統概念圖", 80, f_big, cfg["ink"])
    # center node
    cx, cy = W // 2, 480
    d.ellipse([(cx - 140, cy - 70), (cx + 140, cy + 70)], fill=cfg["primary"])
    bbox = d.textbbox((0, 0), cfg["name"], font=f_node)
    tw = bbox[2] - bbox[0]
    d.text((cx - tw // 2, cy - 18), cfg["name"], font=f_node, fill=(255, 255, 255))
    # surrounding nodes
    around = {
        "app1": ["老師 App", "Arduino R4", "板擦機構", "攝影機", "Gemini AI", "板書雲端"],
        "app2": ["派遣儀表板", "Arduino R4 WiFi", "L293D 四輪", "超音波避障", "Gemini 課輔", "任務報告"],
        "app3": ["匿名感測節點", "Gemini AI 分析", "風險分級", "老師關懷 App", "Firebase 同步", "別名保護"],
    }[app]
    import math
    n = len(around)
    R = 320
    for i, lbl in enumerate(around):
        ang = -math.pi / 2 + 2 * math.pi * i / n
        nx = cx + int(R * math.cos(ang))
        ny = cy + int(R * math.sin(ang))
        # connection line
        d.line([(cx, cy), (nx, ny)], fill=cfg["accent"], width=4)
        # node circle
        d.ellipse([(nx - 90, ny - 40), (nx + 90, ny + 40)], fill=(255, 255, 255), outline=cfg["primary"], width=3)
        bbox = d.textbbox((0, 0), lbl, font=f_label)
        tw = bbox[2] - bbox[0]
        d.text((nx - tw // 2, ny - 14), lbl, font=f_label, fill=cfg["ink"])
    stamp_label(d, cfg)
    img.save(out, "PNG", optimize=True)
    print("wrote", out)


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(outdir, exist_ok=True)
    for app, cfg in APPS.items():
        make_banner(app, cfg, os.path.join(outdir, f"{app}-concept-banner.png"))
        make_timeline(app, cfg, os.path.join(outdir, f"{app}-concept-timeline.png"))
        make_fourframe(app, cfg, os.path.join(outdir, f"{app}-concept-fourframe.png"))
        make_system(app, cfg, os.path.join(outdir, f"{app}-concept-system.png"))


if __name__ == "__main__":
    main()
