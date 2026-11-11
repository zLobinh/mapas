"""Acrescenta à pasta pokemon/ as formas que a coleção de GIFs não tem, usando as artes do app do PMP
(Alola, Galar, Hisui, Paldea, Therian, Origem, Deoxys, Castform... e as Megas X/Y/Z).

    python imagem-link/tools/montar_formas.py [PASTA_DO_APP]

PASTA_DO_APP é a pasta "assets/textures/pokemons" do app (o padrão é a do Pokedex5E-master).
- só ACRESCENTA: os arquivos ganham "forma_" na frente e não mexem nos GIFs;
- roda de novo quando quiser: apaga as "forma_" antigas e põe as de agora;
- o montar_pokemon.py mantém as "forma_" (não apaga), então a ordem dos dois não importa.
No index.json: n = o Pokémon ("Vulpix", "Mega Charizard"), v = a forma ("Alola", "X").
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
APP = Path(r"C:\Users\Keven\Documents\.Pokemon RPG #############\PMP\Pokedex5E-master")
DEFAULT_SRC = APP / "assets" / "textures" / "pokemons"
SPECIES = APP / "p5e-data" / "data" / "pokemon"  # one json per species: the plain names
# words that start a form name in the app's file names ("Vulpix de Alola", "Deoxys Forma de Ataque")
FORM = re.compile(r"^(.+?)\s+((?:de|Forma|Modo|Cavaleiro|Juba|Asas|Tamanho|Linha|Plumagem|Rider|Estilo)\b.*)$")


def ascii_slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9._-]+", "_", text).strip("_")


def png_size(path):
    data = path.read_bytes()[:32]
    return struct.unpack(">II", data[16:24]) if data[:8] == b"\x89PNG\r\n\x1a\n" else (0, 0)


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_dir():
        sys.exit(f"Pasta não encontrada: {src}")
    plain = {p.stem for p in SPECIES.glob("*.json")} if SPECIES.is_dir() else set()
    index_file = OUT / "index.json"
    entries = [e for e in json.loads(index_file.read_text(encoding="utf-8")) if not e["f"].startswith("forma_")]
    for old in OUT.glob("forma_*"):
        old.unlink()
    added = []
    for p in sorted(src.iterdir()):
        m = re.match(r"^(\d+)(.+)$", p.stem)
        if not p.is_file() or p.suffix.lower() != ".png" or not m:
            continue
        num, rest = int(m.group(1)), m.group(2).strip()
        mega = re.match(r"^(.+)_mega([xyz])$", rest, re.I)
        if mega:  # only X / Y / Z: the GIFs already have one Mega per Pokémon, but not which is which
            name, form = f"Mega {mega.group(1)}", mega.group(2).upper()
        elif "_mega" in rest or rest in plain:
            continue
        else:
            f = FORM.match(rest)
            if not f:
                continue
            name, form = f.group(1), re.sub(r"^de\s+", "", f.group(2))
        file = f"forma_{num:04d}_{ascii_slug(name)}_{ascii_slug(form)}.png"
        shutil.copy2(p, OUT / file)
        w, h = png_size(p)
        added.append({"f": file, "d": num, "n": name, "v": form, "w": w, "h": h})
    natural = lambda s: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]
    allx = entries + added
    allx.sort(key=lambda e: (e["d"], e["f"].startswith("mega_") or e["n"].startswith("Mega"), e["n"], natural(e["v"])))
    index_file.write_text(json.dumps(allx, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = sum((OUT / e["f"]).stat().st_size for e in added)
    print(f"{len(added)} formas acrescentadas ({size / 1048576:.1f} MB); {len(allx)} imagens no índice")


if __name__ == "__main__":
    main()
