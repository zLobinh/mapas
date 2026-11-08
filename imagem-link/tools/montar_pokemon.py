"""Monta a pasta de Pokémon que a aba "Pokémon" da extensão Imagem por Link usa.

    python imagem-link/tools/montar_pokemon.py "C:/caminho/da/pasta/com/os/gifs"

- copia as imagens (gif, png, webp) pra <repositório>/pokemon/ com nomes sem acento e sem espaço
  ("0003_Venusaur_fêmea.gif" -> "0003_Venusaur_femea.gif"), pra o link ficar simples;
- gera pokemon/index.json com número, nome, variação e tamanho de cada uma.
Rode de novo sempre que adicionar ou trocar imagens; depois é só subir pelo GitHub Desktop.
"""
import json
import re
import shutil
import struct
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "pokemon"
EXTS = {".gif", ".png", ".webp"}
NAME = re.compile(r"^(\d{1,4})[ _]+(.+)$")


def ascii_slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9._-]+", "_", text).strip("_")


def image_size(path):
    data = path.read_bytes()[:64]
    if data[:3] == b"GIF":
        return struct.unpack("<HH", data[6:10])
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk = data[12:16]
        if chunk == b"VP8X":
            w = int.from_bytes(data[24:27], "little") + 1
            h = int.from_bytes(data[27:30], "little") + 1
            return w, h
    return 0, 0


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(exist_ok=True)
    entries, used = [], set()
    for p in sorted(src.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in EXTS:
            continue
        m = NAME.match(p.stem)
        num = int(m.group(1)) if m else 0
        rest = (m.group(2) if m else p.stem).replace("_", " ").split()
        name, variant = (rest[0] if rest else p.stem), " ".join(rest[1:])
        file = ascii_slug(f"{num:04d}_{'_'.join(rest)}" if m else p.stem) + p.suffix.lower()
        base, i = file, 2
        while file.lower() in used:  # two names that became the same without accents
            file = base.replace(p.suffix.lower(), f"_{i}{p.suffix.lower()}")
            i += 1
        used.add(file.lower())
        shutil.copy2(p, OUT / file)
        w, h = image_size(p)
        entries.append({"f": file, "d": num, "n": name, "v": variant, "w": w, "h": h})
    # images in pokemon/ that don't exist anymore in the source
    for old in OUT.iterdir():
        if old.suffix.lower() in EXTS and old.name.lower() not in used:
            old.unlink()
    entries.sort(key=lambda e: (e["d"], e["n"], e["v"]))
    (OUT / "index.json").write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum((OUT / e["f"]).stat().st_size for e in entries)
    print(f"{len(entries)} imagens em {OUT} ({total / 1048576:.1f} MB)")


if __name__ == "__main__":
    main()
