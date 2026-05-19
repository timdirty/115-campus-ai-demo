"""Scan markdown drafts, render every [IMG: ... | mermaid | ...] whose code
block is inline, and emit PNG files into assets/mermaid-dynamic/.

Pairing logic:
For each [IMG: ... | mermaid | ...] line, find the next ```mermaid ... ```
block within 20 lines and render it. Output name: <app>-inline-<line_no>.png
so build_docx can match by line number.
"""
import re, subprocess, hashlib, os
from pathlib import Path

REPO = Path("/Volumes/Tim aaddtional/Download/115資通訊/tedt")
COMP = REPO / "docs" / "competition"
DRAFTS = COMP / "drafts"
DYN_DIR = COMP / "assets" / "mermaid-dynamic"
DYN_DIR.mkdir(parents=True, exist_ok=True)

IMG_RE = re.compile(r"^\s*\[IMG:\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\]\s*$")
MMD_OPEN = re.compile(r"^```mermaid\s*$")
MMD_CLOSE = re.compile(r"^```\s*$")

PUPPETEER = DYN_DIR / "puppeteer.json"
PUPPETEER.write_text('{"args": ["--no-sandbox"]}')


def render(mmd_text: str, out: Path) -> bool:
    h = hashlib.sha1(mmd_text.encode("utf-8")).hexdigest()[:10]
    src = DYN_DIR / f"_tmp_{h}.mmd"
    src.write_text(mmd_text, encoding="utf-8")
    try:
        r = subprocess.run(
            ["mmdc", "-i", str(src), "-o", str(out),
             "-w", "1600", "-H", "1200",
             "-t", "default", "-b", "transparent",
             "-p", str(PUPPETEER)],
            capture_output=True, timeout=60
        )
        ok = out.exists() and out.stat().st_size > 100
        if not ok:
            print(f"  fail: {out.name}: {r.stderr.decode()[:200]}")
        return ok
    except Exception as e:
        print(f"  exception: {e}")
        return False
    finally:
        src.unlink(missing_ok=True)


def process(app_key: str, md_path: Path):
    lines = md_path.read_text(encoding="utf-8").splitlines()
    n = len(lines)
    rendered = 0
    for i, line in enumerate(lines):
        m = IMG_RE.match(line)
        if not m:
            continue
        if m.group(2).strip().lower() != "mermaid":
            continue
        # search next 30 lines for ```mermaid
        for j in range(i + 1, min(i + 30, n)):
            if MMD_OPEN.match(lines[j]):
                # collect until close
                buf = []
                k = j + 1
                while k < n and not MMD_CLOSE.match(lines[k]):
                    buf.append(lines[k])
                    k += 1
                out = DYN_DIR / f"{app_key}-inline-L{i+1:04d}.png"
                if render("\n".join(buf), out):
                    rendered += 1
                break
    print(f"  {app_key}: rendered {rendered} inline mermaid")


def main():
    pairs = [
        ("app1", DRAFTS / "app1-rewrite-draft.md"),
        ("app2", DRAFTS / "app2-rewrite-draft.md"),
        ("app3", DRAFTS / "app3-rewrite-draft.md"),
    ]
    for ak, mp in pairs:
        process(ak, mp)


if __name__ == "__main__":
    main()
