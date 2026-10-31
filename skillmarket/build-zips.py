#!/usr/bin/env python3
"""ZIP de distribution ChatGPT et plugin, sans dépendances tierces."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
SKILLS = ("fixit", "table-ronde")

def write_zip(name, files):
    DIST.mkdir(parents=True, exist_ok=True)
    destination = DIST / name
    with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
        for src, target in files:
            if not src.is_file() or src.is_symlink():
                raise ValueError(f"Source invalide : {src}")
            archive.write(src, arcname=target)
    print(destination)
    return destination

def build():
    for skill in SKILLS:
        path = ROOT / "skills" / skill / "SKILL.md"
        display = "Fixit" if skill == "fixit" else "TableRonde"
        write_zip(f"{display}-ChatGPT.zip", [(path, f"{skill}/SKILL.md")])
    plugin_files = [(ROOT / "plugin.json", "plugin.json")]
    plugin_files += [
        (ROOT / "skills" / skill / "SKILL.md", f"skills/{skill}/SKILL.md")
        for skill in SKILLS
    ]
    write_zip("SkillMarket-Plugin.zip", plugin_files)

if __name__ == "__main__":
    build()
