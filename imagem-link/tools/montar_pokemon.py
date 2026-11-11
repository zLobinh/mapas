"""Monta a pasta de Pokémon que a aba "Pokémon" da extensão Imagem por Link usa.

    python imagem-link/tools/montar_pokemon.py PASTA [PASTA ...]

Cada PASTA pode vir com um prefixo:
    "caminho"             sprites normais
    "Mega=caminho"        Mega Evoluções: o nome vira "Mega Charizard" ("Primal Kyogre"/"Primal Groudon")
    "Mega+=caminho"       reserva: só entram os Pokémon que ainda não têm nenhuma imagem desse grupo
                          (ex.: estáticos pra completar quem não tem GIF)
A ordem importa: liste primeiro o que tem prioridade. Só os arquivos de dentro de cada pasta são lidos
(subpastas não), então aponte pra pasta certa.

Exemplo (GIF primeiro, estáticos só pra quem faltar):
    python imagem-link/tools/montar_pokemon.py "Pokémons" "Mega=Megas" "Mega+=Megas/Estáticos/Refeitos" "Mega+=Megas/Estáticos"

- copia as imagens (gif, png, webp) pra <repositório>/pokemon/ com nomes sem acento e sem espaço
  ("0003_Venusaur_fêmea.gif" -> "0003_Venusaur_femea.gif"; Megas com "mega_" na frente);
- gera pokemon/index.json com número, nome, variação e tamanho de cada uma;
- apaga de pokemon/ as imagens que não vieram de nenhuma pasta (então passe TODAS as pastas sempre).
Rode de novo sempre que adicionar ou trocar imagens; depois é só publicar.
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
PRIMAL = {382, 383}  # Kyogre, Groudon


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


def parse_source(arg):
    """'Mega+=path' -> ('Mega', True, path); 'path' -> ('', False, path)"""
    m = re.match(r"^([A-Za-z]+)(\+?)=(.+)$", arg)
    if m and not re.match(r"^[A-Za-z]:[\\/]", arg):  # not a Windows drive letter
        return m.group(1), m.group(2) == "+", Path(m.group(3))
    return "", False, Path(arg)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    OUT.mkdir(exist_ok=True)
    entries, used = [], set()
    have = set()  # (group, dex number) already with an image
    for arg in sys.argv[1:]:
        group, only_missing, src = parse_source(arg)
        if not src.is_dir():
            sys.exit(f"Pasta não encontrada: {src}")
        added_here = set()
        for p in sorted(src.iterdir()):
            if not p.is_file() or p.suffix.lower() not in EXTS:
                continue
            m = NAME.match(p.stem)
            num = int(m.group(1)) if m else 0
            if only_missing and (group, num) in have:
                continue  # this one already has a (better) image in the group
            rest = (m.group(2) if m else p.stem).replace("_", " ").split()
            name, variant = (rest[0] if rest else p.stem), " ".join(rest[1:])
            stem = f"{num:04d}_{'_'.join(rest)}" if m else p.stem
            if group:
                label = "Primal" if group == "Mega" and num in PRIMAL else group
                name = f"{label} {name}"
                stem = f"{group.lower()}_{stem}"
            file = ascii_slug(stem) + p.suffix.lower()
            base, i = file, 2
            while file.lower() in used:  # two names that became the same without accents
                file = base.replace(p.suffix.lower(), f"_{i}{p.suffix.lower()}")
                i += 1
            used.add(file.lower())
            added_here.add((group, num))
            shutil.copy2(p, OUT / file)
            w, h = image_size(p)
            entries.append({"f": file, "d": num, "n": name, "v": variant, "w": w, "h": h})
        have |= added_here
        print(f"{src}: {sum(1 for g in added_here)} Pokémon")
    # images in pokemon/ that didn't come from any folder
    # (the "forma_" ones come from montar_formas.py: they stay, with their index entries)
    index_file = OUT / "index.json"
    if index_file.exists():
        entries += [e for e in json.loads(index_file.read_text(encoding="utf-8")) if e["f"].startswith("forma_") and (OUT / e["f"]).exists()]
    for old in OUT.iterdir():
        if old.suffix.lower() in EXTS and old.name.lower() not in used and not old.name.startswith("forma_"):
            old.unlink()
    # normal forms first, then Megas, inside each number
    # (variations in number order: 2 before 10)
    natural = lambda s: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]
    entries.sort(key=lambda e: (e["d"], e["f"].startswith("mega_"), e["n"], natural(e["v"])))
    (OUT / "index.json").write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum((OUT / e["f"]).stat().st_size for e in entries if (OUT / e["f"]).exists())
    print(f"{len(entries)} imagens em {OUT} ({total / 1048576:.1f} MB)")


if __name__ == "__main__":
    main()
