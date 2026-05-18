"""Generate 4 flat-infographic images for App 2 speech using Gemini Image API.

Uses gemini-2.5-flash-image-preview (Nano Banana) — multimodal model that
emits image bytes inline. Requires GEMINI_API_KEY from app2/.env.

Output: docs/competition/assets/ai-generated/app2-speech-*.png
"""
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ENV_PATH = REPO_ROOT / "apps" / "app2-campus-service" / ".env"
OUT_DIR = REPO_ROOT / "docs" / "competition" / "assets" / "ai-generated"


def load_api_key() -> str:
    if "GEMINI_API_KEY" in os.environ:
        return os.environ["GEMINI_API_KEY"]
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"GEMINI_API_KEY not found in env or {ENV_PATH}")


SHARED_STYLE = (
    "Visual style: minimalist flat infographic in the Apple Keynote and Stripe documentation aesthetic. "
    "Soft off-white background. Use a soft pastel palette of muted blue, teal, lavender, peach, and mint. "
    "Plenty of whitespace. Clean modern flat icons, no photorealism, no drop shadows, no gradients. "
    "16:9 widescreen layout. Use rounded rectangle containers for each section with thin borders. "
    "Bold arrows where indicated. CRITICAL TEXT REQUIREMENT: every Chinese label must render exactly "
    "as the Traditional Chinese characters provided in quotes, with no substitution, no garbled glyphs, "
    "and no invented characters. Use a clean sans-serif Chinese font."
)

PROMPTS = {
    "app2-speech-timeline-5min": (
        "Create a horizontal timeline infographic image titled '校園 AI 服務機器人 ｜ 5 分鐘決賽流程'. "
        "Five colored segments left-to-right showing speech sections, each labeled in Traditional Chinese "
        "with the section name, duration, and speaker name. The widths of segments are proportional to time:\n"
        "Segment 1 (blue, narrow): '① 主講開場 / 45秒 / 懿範'\n"
        "Segment 2 (teal, narrow): '② 硬體說明 / 45秒 / 品縣・愛・家齊'\n"
        "Segment 3 (lavender, narrow): '③ 軟體說明 / 45秒 / 自喊'\n"
        "Segment 4 (peach, WIDE - this is the largest segment): '④ DEMO 實操 / 135秒 / 子換'\n"
        "Segment 5 (mint, very narrow): '⑤ 收尾 / 20秒 / 懿範'\n"
        "Below the timeline, add a small footer note: '總長 290 秒 + 10 秒切換緩衝 = 300 秒'. "
        + SHARED_STYLE
    ),
    "app2-speech-three-closure-demo": (
        "Create a flat infographic image titled '三閉環 Demo 流程 ｜ App 2'. "
        "Three large rounded rectangular cards arranged horizontally, connected by bold right-pointing arrows. "
        "Each card has an icon at top, a Traditional Chinese title in the middle, "
        "and a duration tag at the bottom.\n"
        "Card 1 (mint background): icon = AI camera + Gemini sparkle, "
        "title = '教學閉環 / AI 點名', tag = '35 秒'\n"
        "Card 2 (peach background): icon = small wheeled robot carrying a delivery box, "
        "title = '配送閉環 / 福利社配送', tag = '40 秒'\n"
        "Card 3 (lavender background): icon = dashboard with temperature and AQI gauges, "
        "title = '生活閉環 / 生活派遣', tag = '35 秒'\n"
        "Below the three cards, draw a progress bar showing '0/3 → 1/3 → 2/3 → 3/3 完成'. "
        + SHARED_STYLE
    ),
    "app2-speech-hardware-3-layer": (
        "Create a flat infographic image titled '硬體三層架構 ｜ App 2 校園服務機器人'. "
        "Three large horizontal layers stacked vertically. Each layer is a rounded rectangle "
        "with a layer-name label on the left and component icons + labels on the right. "
        "From top to bottom:\n"
        "TOP LAYER (blue background, labeled '① 主控層'): icon = Arduino UNO board with WiFi antenna, "
        "labels: 'Arduino UNO R4 WiFi', 'USB Serial → Bridge Server', '3 秒看門狗'\n"
        "MIDDLE LAYER (teal background, labeled '② 感測層'): icon = ultrasonic sensor + camera lens with sparkle, "
        "labels: 'HC-SR04 超音波避障', 'AI Camera + Gemini Vision'\n"
        "BOTTOM LAYER (peach background, labeled '③ 動力層'): icon = four wheels + IC chip, "
        "labels: 'L293D × 2 馬達驅動', 'TT Motor × 4', 'M1+M2 驅動輪 ｜ M3+M4 清掃滾筒'\n"
        + SHARED_STYLE
    ),
    "app2-speech-software-3-layer": (
        "Create a flat infographic image titled '軟體三層架構 ｜ 平板 → AI → Arduino'. "
        "Three large horizontal layers stacked vertically, with bold downward arrows connecting them. "
        "Each layer is a rounded rectangle with a label on the left and an icon-plus-text panel on the right.\n"
        "TOP LAYER (lavender, '① 介面層'): tablet device icon showing React App with three tab buttons "
        "labeled '教學', '配送', '生活'. Subtitle: 'React 中控台'\n"
        "MIDDLE LAYER (mint, '② AI 層'): camera icon → arrow → cloud labeled 'Gemini 2.5 Flash Vision' → arrow → "
        "response card showing '出席率 92% / 約 28 人 / 分心訊號'\n"
        "BOTTOM LAYER (peach, '③ 橋接層'): laptop icon labeled 'Bridge Server' → USB icon → Arduino board, "
        "with a side branch via WebSocket icon to a second screen showing a robot emoji face. "
        "Labels: 'FORWARD / DELIVERY_START', 'WebSocket → 機器人表情同步'\n"
        + SHARED_STYLE
    ),
}


def main() -> int:
    api_key = load_api_key()
    print(f"[ok] loaded GEMINI_API_KEY ({len(api_key)} chars)")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    model_id = os.environ.get("IMAGEN_MODEL", "gemini-3-pro-image-preview")
    print(f"[info] using model: {model_id}")
    results = []

    use_imagen = model_id.startswith("imagen-")

    for slug, prompt in PROMPTS.items():
        out_path = OUT_DIR / f"{slug}.png"
        print(f"\n[gen] {slug}")
        try:
            if use_imagen:
                response = client.models.generate_images(
                    model=model_id,
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        aspect_ratio="16:9",
                        output_mime_type="image/png",
                    ),
                )
            else:
                response = client.models.generate_content(
                    model=model_id,
                    contents=[prompt],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
        except Exception as exc:
            print(f"  [error] {exc}")
            results.append((slug, False, str(exc)))
            continue

        saved = False
        if use_imagen:
            for gen in response.generated_images or []:
                img = getattr(gen, "image", None)
                data = getattr(img, "image_bytes", None) if img else None
                if data:
                    out_path.write_bytes(data)
                    size_kb = out_path.stat().st_size / 1024
                    print(f"  [ok] saved {out_path.name} ({size_kb:.1f} KB)")
                    results.append((slug, True, str(out_path)))
                    saved = True
                    break
        else:
            for part in response.candidates[0].content.parts:
                inline = getattr(part, "inline_data", None)
                if inline and inline.mime_type and inline.mime_type.startswith("image/"):
                    out_path.write_bytes(inline.data)
                    size_kb = out_path.stat().st_size / 1024
                    print(f"  [ok] saved {out_path.name} ({size_kb:.1f} KB)")
                    results.append((slug, True, str(out_path)))
                    saved = True
                    break
                elif getattr(part, "text", None):
                    print(f"  [text-out] {part.text[:150]}")
        if not saved:
            print("  [warn] no image returned")
            results.append((slug, False, "no image bytes"))

    print("\n=== SUMMARY ===")
    for slug, ok, info in results:
        flag = "OK" if ok else "FAIL"
        print(f"  {flag}  {slug}  {info}")

    failed = [r for r in results if not r[1]]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
