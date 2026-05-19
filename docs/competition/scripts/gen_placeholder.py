"""Generate grayscale placeholder images for real-machine photos.

Per user feedback: no app accent colors. Plain B&W official look.
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1600, 1200
BG = (250, 250, 250)
BORDER = (160, 160, 160)
TITLE = (40, 40, 40)
SUB = (90, 90, 90)
NOTE = (130, 130, 130)
DARK_GRAY = (80, 80, 80)


def find_font(size):
    paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()


def draw_dashed_rect(draw, xy, color, dash=18, gap=12, width=4):
    x0, y0, x1, y1 = xy
    for x in range(x0, x1, dash + gap):
        draw.line([(x, y0), (min(x + dash, x1), y0)], fill=color, width=width)
        draw.line([(x, y1), (min(x + dash, x1), y1)], fill=color, width=width)
    for y in range(y0, y1, dash + gap):
        draw.line([(x0, y), (x0, min(y + dash, y1))], fill=color, width=width)
        draw.line([(x1, y), (x1, min(y + dash, y1))], fill=color, width=width)


def make_placeholder(app, title, sub, checklist, outfile):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Dashed border placeholder area
    draw_dashed_rect(d, (60, 60, W - 60, H - 60), BORDER, dash=22, gap=14, width=4)

    # Inner white fill
    d.rectangle([(100, 100), (W - 100, H - 100)], fill=(255, 255, 255), outline=BORDER, width=2)

    f_title = find_font(96)
    f_sub = find_font(46)
    f_note = find_font(32)
    f_label = find_font(36)

    # Camera icon (simple geometric, dark gray)
    icon_x, icon_y = W // 2 - 80, 200
    d.rounded_rectangle([(icon_x, icon_y), (icon_x + 160, icon_y + 110)], radius=10, fill=DARK_GRAY)
    d.ellipse([(icon_x + 50, icon_y + 18), (icon_x + 110, icon_y + 78)], fill=(255, 255, 255), outline=DARK_GRAY, width=6)
    d.rectangle([(icon_x + 22, icon_y - 14), (icon_x + 58, icon_y + 4)], fill=DARK_GRAY)

    label = "實機照　待補拍"
    bbox = d.textbbox((0, 0), label, font=f_title)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, 360), label, font=f_title, fill=TITLE)

    bbox = d.textbbox((0, 0), title, font=f_sub)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, 490), title, font=f_sub, fill=SUB)

    bbox = d.textbbox((0, 0), sub, font=f_note)
    tw = bbox[2] - bbox[0]
    d.text(((W - tw) // 2, 560), sub, font=f_note, fill=NOTE)

    # Checklist box (gray)
    box_top = 660
    d.rectangle([(220, box_top), (W - 220, box_top + 400)], outline=DARK_GRAY, width=2)
    d.text((260, box_top + 20), "建議拍攝清單", font=f_label, fill=DARK_GRAY)
    y = box_top + 90
    for i, item in enumerate(checklist[:5]):
        # Use number in gray circle outline
        d.ellipse([(280, y + 8), (310, y + 38)], outline=DARK_GRAY, width=3)
        f_num = find_font(24)
        bbox = d.textbbox((0, 0), str(i + 1), font=f_num)
        tw = bbox[2] - bbox[0]
        d.text((295 - tw // 2, y + 12), str(i + 1), font=f_num, fill=DARK_GRAY)
        d.text((340, y), item, font=f_note, fill=SUB)
        y += 56

    img.save(outfile, "PNG", optimize=True)
    print("wrote", outfile)


PLACEHOLDERS = [
    ("app1", "machine-front", "AI 智慧型白板機器人　正面實機照",
     "顯示 3D 列印外殼、板擦臂、攝影機完整露出",
     ["45 度俯視全機照（含板擦臂展開）",
      "板擦臂特寫（伺服機 SG90 + 3D 列印手指）",
      "Arduino R4 + L293D 接線板背面",
      "攝影機（ESP32-CAM 或 USB cam）模組特寫",
      "LED 8x8 矩陣顯示完成動畫瞬間"]),
    ("app1", "machine-wiring", "板擦機器人接線特寫",
     "Arduino R4 Minima + L293D + TT motor 連接細節",
     ["L293D 雙 H-Bridge 通電狀態",
      "TT motor 與 L293D 接線端子",
      "Arduino R4 Minima USB 連線狀態",
      "電源供應（行動電源或鋰電池）",
      "杜邦線整線（不要亂糟糟）"]),
    ("app1", "demo-live", "白板擦拭 Demo 連拍",
     "現場示範擦除 A 區 / B 區 / 全板的真實畫面",
     ["擦除前的白板（有字跡狀態）",
      "機器人移動到目標區域中（軌道上）",
      "擦除中的瞬間（板擦壓在白板）",
      "擦除後乾淨白板對比",
      "LED 動畫播放畫面"]),

    ("app2", "machine-front", "校園 AI 多功能服務機器人　主視角",
     "四輪驅動 + 太陽能板 + 載物托盤 + 掃地刷一機呈現",
     ["俯視全機照（顯示頂部太陽能板）",
      "正面照（顯示載物托盤 + 配送物品）",
      "底部特寫（M3+M4 掃地滾輪 + 刷具）",
      "Arduino R4 WiFi + L293D 雙板接線",
      "超音波 HC-SR04 + 顏色感測 TCS230 安裝位置"]),
    ("app2", "delivery-loop", "配送任務實境照",
     "教室 → 圖書館 / 保健室 / 辦公室 完整配送過程",
     ["接收任務的儀表板（手機/平板）",
      "機器人載著物品出發",
      "途中避障的瞬間（超音波觸發）",
      "到達目的地、接收方確認",
      "回報完成的儀表板畫面"]),
    ("app2", "fleet-multi", "多機協作合照",
     "4 台機器人同時部署在不同任務的證據",
     ["4 台機器人排列合影",
      "1 號清潔中、2 號配送中、3 號充電中、4 號待命",
      "派遣儀表板顯示 4 台狀態",
      "底部顯示電量百分比 / 任務數",
      "團隊集體照（不露校園可識別物）"]),

    ("app3", "sensor-node", "感測節點實機照",
     "HY-M302 + DHT11 + 光敏 + RGB LED + Arduino R4 完整節點",
     ["感測節點正面（3D 列印外殼 + RGB 燈號）",
      "拆開外殼內部（顯示 Arduino + HY-M302）",
      "DHT11 + 光敏電阻安裝位置",
      "RGB LED 顯示綠燈（低風險示意）",
      "RGB LED 顯示紅燈（高風險示意）"]),
    ("app3", "patrol-bot", "巡邏機器人實機照",
     "四輪驅動 + 感測模組 + 麥克風的移動式關懷單元",
     ["俯視全機照（顯示頂部感測陣列）",
      "L293D + 4 顆 TT motor 動力底盤",
      "麥克風（MAX9814）安裝位置",
      "巡邏中的瞬間（移動模糊更佳）",
      "3D 列印外殼設計細節（柔和線條）"]),
    ("app3", "deploy-scene", "場域部署實況",
     "感測節點安裝於走廊 / 教室 / 輔導室的真實場景",
     ["走廊感測節點（高處安裝、無校名露出）",
      "教室節點（黑板側 / 講台旁）",
      "輔導室節點（隱蔽位置、不入鏡學生）",
      "節點 RGB 燈號運作狀態（綠燈巡邏中）",
      "整體場域全景（去識別性處理）"]),
]


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(outdir, exist_ok=True)
    for app, name, title, sub, checklist in PLACEHOLDERS:
        outfile = os.path.join(outdir, f"{app}-placeholder-{name}.png")
        make_placeholder(app, title, sub, checklist, outfile)


if __name__ == "__main__":
    main()
