"""Remove orphan media (images not referenced by XML parts) from docx zip.

When we open v1 docx as template and re-author the body, the old images stay
in word/media/ and inflate the file. This also removes the stale image
relationships; otherwise Word may render the PDF but python-docx/Word package
validation can still fail on dangling media targets.
"""
import sys, re, zipfile, shutil, os
from pathlib import Path
from xml.etree import ElementTree as ET

REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
ET.register_namespace("", REL_NS)


def rels_owner_xml(rels_path: str) -> str | None:
    """Return the XML part that owns a _rels/*.rels file."""
    if not rels_path.endswith(".rels") or "/_rels/" not in rels_path:
        return None
    folder, name = rels_path.rsplit("/_rels/", 1)
    return f"{folder}/{name[:-5]}"


def resolve_media_target(rels_path: str, target: str) -> str:
    """Resolve an OPC relationship target to a zip member path."""
    if target.startswith("/"):
        return target.lstrip("/")
    owner = rels_owner_xml(rels_path) or ""
    base = Path(owner).parent
    return str((base / target).as_posix()).replace("word/../", "")


def used_relationship_ids(xml: str) -> set[str]:
    return set(re.findall(r'(?:r:embed|r:link|r:id)="(rId\d+)"', xml))


def cleaned_rels_xml(rels_xml: bytes, used_rids: set[str], rels_path: str):
    """Remove unused image relationships and report media still referenced."""
    root = ET.fromstring(rels_xml)
    used_media = set()
    removed_count = 0
    for rel in list(root):
        rid = rel.attrib.get("Id", "")
        target = rel.attrib.get("Target", "")
        rel_type = rel.attrib.get("Type", "")
        is_media = "image" in rel_type or "/media/" in target or target.startswith("media/")
        if not is_media:
            continue
        media_path = resolve_media_target(rels_path, target)
        if rid in used_rids:
            used_media.add(media_path)
        else:
            root.remove(rel)
            removed_count += 1
    return ET.tostring(root, encoding="utf-8", xml_declaration=True), used_media, removed_count


def clean(docx_path: Path):
    tmp = docx_path.with_suffix(".docx.tmp")

    with zipfile.ZipFile(docx_path, "r") as zin:
        names = set(zin.namelist())
        if "word/document.xml" not in names:
            print(f"  skip {docx_path.name}: no document.xml")
            return

        media_used = set()
        rels_rewrites = {}
        removed_rels = 0

        for name in zin.namelist():
            if not name.startswith("word/_rels/") or not name.endswith(".rels"):
                continue
            owner = rels_owner_xml(name)
            if owner not in names:
                continue
            owner_xml = zin.read(owner).decode("utf-8", errors="ignore")
            used_rids = used_relationship_ids(owner_xml)
            new_rels, used_media, removed = cleaned_rels_xml(zin.read(name), used_rids, name)
            if removed:
                rels_rewrites[name] = new_rels
                removed_rels += removed
            media_used.update(used_media)

        all_media = [n for n in zin.namelist() if n.startswith("word/media/")]
        removed = [n for n in all_media if n not in media_used]
        if not removed and not rels_rewrites:
            print(f"  {docx_path.name}: no orphans")
            return

        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for name in zin.namelist():
                if name in removed:
                    continue
                if name in rels_rewrites:
                    zout.writestr(name, rels_rewrites[name])
                else:
                    zout.writestr(name, zin.read(name))

    before = docx_path.stat().st_size
    shutil.move(str(tmp), str(docx_path))
    after = docx_path.stat().st_size
    print(f"  {docx_path.name}: removed {len(removed)} orphan media and {removed_rels} stale rels, "
          f"{before/1024/1024:.1f}MB → {after/1024/1024:.1f}MB")


def main():
    out_dir = Path("/Volumes/Tim aaddtional/Download/準備比賽")
    for f in sorted(out_dir.glob("*_v2.docx")):
        clean(f)


if __name__ == "__main__":
    main()
