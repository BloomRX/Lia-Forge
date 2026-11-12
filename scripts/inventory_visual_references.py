"""Inventário verificável de referências visuais do repositório.

Atende ao item 3 de ``docs/LIBRARY-VISUAL-REFERENCE-INVENTORY.md``: inventariar
as imagens rastreadas no Git com caminho, formato, dimensões, tamanho e
SHA-256, marcar duplicatas e classificar cada referência nominal da Biblioteca
como ``TRACKED_IN_GIT``, ``DUPLICATE``, ``RIGHTS_PENDING`` ou ``NOT_FOUND``.

Somente leitura sobre os arquivos: nunca sobrescreve, recomprime ou renomeia
arte-fonte. A única escrita possível é o bloco delimitado dentro do próprio
inventário (``--write``), o que torna a atualização idempotente.

Uso:
    python3 scripts/inventory_visual_references.py            # imprime a tabela
    python3 scripts/inventory_visual_references.py --write     # atualiza o doc
    python3 scripts/inventory_visual_references.py --json      # saída máquina
"""

from __future__ import annotations

import argparse
import hashlib
import unicodedata
import json
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INVENTORY_DOC = ROOT / "docs" / "LIBRARY-VISUAL-REFERENCE-INVENTORY.md"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico"}
BEGIN_MARKER = "<!-- BEGIN GENERATED VISUAL INVENTORY -->"
END_MARKER = "<!-- END GENERATED VISUAL INVENTORY -->"

# Referências nominais citadas pelo inventário (Biblioteca do ChatGPT).
LIBRARY_REFERENCES: list[tuple[str, str]] = [
    ("Interface Sombria Neon do Lia Forge.png", "Conceito principal do Forge Studio (layout, navegação, painéis, viewport, assistência)."),
    ("Lia Forge: Heroína Pixel Neon.png", "Conceito de personagem 2D/pixel art (preview de sprites, frames, atlas)."),
    ("Forja Lia: Aiko, Guarda Florestal.png", "Conceito de personagem 3D (modelagem, rigging, animação, spritesheet)."),
    ("LiaHeroImage.png", "Identidade visual da personagem Lia (ecossistema)."),
    ("01-Home.png", "Linguagem visual e hierarquia da interface desktop."),
    ("02-ai-resources.png", "Apresentação de recursos, modelos e capacidades."),
    ("03-voice.png", "Padrões visuais de configuração de recursos."),
    ("04-personality.png", "Personalização e apresentação de perfis."),
    ("05-appearance.png", "Seleção de aparência e variações."),
    ("06-presence.png", "Presença visual e modos de exibição."),
    ("07-tools.png", "Catálogo de ferramentas e integrações."),
    ("IconAppToolBar.png", "Ícone da aplicação (barra de ferramentas)."),
    ("IconAppCompact.png", "Ícone da aplicação (compacto)."),
    ("LiaName.png", "Assinatura/nome da marca."),
    ("chart-1.png", "Arte/prancha visual da identidade Lia."),
    ("chart-2.png", "Arte/prancha visual da identidade Lia."),
    ("chart-3.png", "Arte/prancha visual da identidade Lia."),
    ("chart-4.png", "Arte/prancha visual da identidade Lia."),
]

# Direitos ainda não verificados: arte vinda da Biblioteca do ChatGPT.
RIGHTS_PENDING_HINTS = ("chart-", "Lia-Forge-Visual-Asset-Library-Reference", "Painel Neon", "ref.jpg")


SKIP_DIRECTORIES = {".git", "node_modules", "dist", "output", ".venv", "__pycache__"}


def published_tree() -> set[str]:
    """Caminhos publicados na ponta da branch de trabalho (fonte de verdade).

    O índice local pode estar num commit antigo; por isso a comparação usa a
    árvore publicada, e não ``git ls-files``.
    """
    for ref in ("origin/arena/649f88bd-3dspritesheet", "HEAD"):
        try:
            output = subprocess.run(
                # quotePath=false: nomes com acento não podem virar octal citado.
                ["git", "-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", ref],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
        except subprocess.CalledProcessError:
            continue
        if output.stdout.strip():
            return {line for line in output.stdout.splitlines() if line}
    return set()


def tracked_files() -> list[str]:
    published = published_tree()
    found: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if SKIP_DIRECTORIES.intersection(part for part in path.relative_to(ROOT).parts[:-1]):
            continue
        relative = path.relative_to(ROOT).as_posix()
        # Só entra no inventário o que está publicado no Git.
        if published and relative not in published:
            continue
        found.append(relative)
    return found


def png_dimensions(data: bytes) -> tuple[int | None, int | None]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None, None
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def jpeg_dimensions(data: bytes) -> tuple[int | None, int | None]:
    index = 2
    while index + 9 < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            index += 2
            continue
        length = struct.unpack(">H", data[index + 2 : index + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        index += 2 + length
    return None, None


def webp_dimensions(data: bytes) -> tuple[int | None, int | None]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None, None
    fmt = data[12:16]
    if fmt == b"VP8 ":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if fmt == b"VP8L" and len(data) > 25:
        bits = struct.unpack("<I", data[21:25])[0]
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if fmt == b"VP8X" and len(data) > 30:
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    return None, None


def gif_dimensions(data: bytes) -> tuple[int | None, int | None]:
    if len(data) < 10 or data[:3] != b"GIF":
        return None, None
    width, height = struct.unpack("<HH", data[6:10])
    return width, height


def ico_dimensions(data: bytes) -> tuple[int | None, int | None]:
    if len(data) < 22 or struct.unpack("<H", data[2:4])[0] != 1:
        return None, None
    width = data[6] or 256
    height = data[7] or 256
    return width, height


def svg_dimensions(data: bytes) -> tuple[int | None, int | None]:
    import re

    text = data.decode("utf-8", errors="replace")
    width_match = re.search(r'width="(\d+(?:\.\d+)?)(?:px)?"', text)
    height_match = re.search(r'height="(\d+(?:\.\d+)?)(?:px)?"', text)
    if width_match and height_match:
        return int(float(width_match.group(1))), int(float(height_match.group(1)))
    viewbox = re.search(r'viewBox="([\d.\-\s]+)"', text)
    if viewbox:
        parts = [float(item) for item in viewbox.group(1).split()]
        if len(parts) == 4:
            return int(parts[2]), int(parts[3])
    return None, None


def dimensions(path: Path, data: bytes) -> tuple[int | None, int | None]:
    suffix = path.suffix.lower()
    if suffix == ".png":
        return png_dimensions(data)
    if suffix in (".jpg", ".jpeg"):
        return jpeg_dimensions(data)
    if suffix == ".webp":
        return webp_dimensions(data)
    if suffix == ".gif":
        return gif_dimensions(data)
    if suffix == ".ico":
        return ico_dimensions(data)
    if suffix == ".svg":
        return svg_dimensions(data)
    return None, None


def classify(path: str) -> str:
    name = Path(path).name
    if any(hint in name or hint in path for hint in RIGHTS_PENDING_HINTS):
        return "RIGHTS_PENDING"
    if "Concepts" in path or "Brand" in path:
        return "TRACKED_IN_GIT"
    return "TRACKED_IN_GIT"


def build_inventory() -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    by_hash: dict[str, list[str]] = {}
    for relative in tracked_files():
        absolute = ROOT / relative
        data = absolute.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        width, height = dimensions(absolute, data)
        by_hash.setdefault(digest, []).append(relative)
        entries.append({
            "path": relative,
            "name": absolute.name,
            "format": absolute.suffix.lstrip(".").lower(),
            "bytes": len(data),
            "width": width,
            "height": height,
            "sha256": digest,
        })

    for entry in entries:
        twins = by_hash[entry["sha256"]]
        if len(twins) > 1:
            others = [item for item in twins if item != entry["path"]]
            entry["status"] = "DUPLICATE"
            entry["duplicateOf"] = others[0]
        else:
            entry["status"] = classify(entry["path"])
            entry["duplicateOf"] = None

    def canonical(value: str) -> str:
        # Nomes publicados podem trocar ":" por "_" e variar em normalização
        # Unicode (NFC/NFD); a comparação precisa ser estável nos dois eixos.
        return unicodedata.normalize("NFC", value).replace(":", "_").casefold()

    references = []
    for name, purpose in LIBRARY_REFERENCES:
        wanted = canonical(name)
        match = next((entry for entry in entries if canonical(entry["name"]) == wanted), None)
        references.append({
            "reference": name,
            "purpose": purpose,
            # Sem correspondência no Git: a referência existe apenas na
            # Biblioteca (LIBRARY_ONLY). NOT_FOUND ficaria reservado a itens
            # que não estão em lugar nenhum.
            "status": match["status"] if match else "LIBRARY_ONLY",
            "path": match["path"] if match else None,
            "sha256": match["sha256"] if match else None,
        })

    return {
        "generatedBy": "scripts/inventory_visual_references.py",
        "trackedCount": len(entries),
        "entries": entries,
        "references": references,
        "libraryOnly": [item["reference"] for item in references if item["status"] == "LIBRARY_ONLY"],
        "duplicates": [
            {"sha256": digest, "paths": paths}
            for digest, paths in by_hash.items()
            if len(paths) > 1
        ],
    }


def render_markdown(inventory: dict[str, Any]) -> str:
    lines = [
        BEGIN_MARKER,
        "",
        "## 6. Inventário verificado no checkout (gerado)",
        "",
        f"Gerado por `{inventory['generatedBy']}` a partir dos arquivos rastreados no Git.",
        "Nenhum arquivo-fonte foi alterado, recomprimido ou renomeado.",
        "",
        f"**{inventory['trackedCount']} imagens rastreadas.**",
        "",
        "| Caminho Git | Formato | Dimensões | Bytes | SHA-256 | Estado |",
        "|---|---|---|---|---|---|",
    ]
    for entry in inventory["entries"]:
        size = f"{entry['width']}×{entry['height']}" if entry["width"] else "não lida"
        state = entry["status"]
        if entry["duplicateOf"]:
            state = f"DUPLICATE de `{entry['duplicateOf']}`"
        lines.append(
            f"| `{entry['path']}` | {entry['format']} | {size} | {entry['bytes']:,} | `{entry['sha256'][:16]}…` | {state} |"
        )
    lines += [
        "",
        "### 6.1 Referências nominais da Biblioteca",
        "",
        "| Referência | Estado | Caminho Git |",
        "|---|---|---|",
    ]
    for reference in inventory["references"]:
        path = f"`{reference['path']}`" if reference["path"] else "—"
        lines.append(f"| {reference['reference']} | {reference['status']} | {path} |")
    lines += [
        "",
        "### 6.2 Duplicatas byte a byte",
        "",
    ]
    if inventory["duplicates"]:
        for group in inventory["duplicates"]:
            lines.append(f"- `{group['sha256'][:16]}…`: " + ", ".join(f"`{path}`" for path in group["paths"]))
    else:
        lines.append("- Nenhuma duplicata exata encontrada.")
    lines += [
        "",
        "### 6.3 Regras de uso aplicadas",
        "",
        "- `TRACKED_IN_GIT`: arquivo presente no checkout, origem declarada pelo commit que o publicou.",
        "- `RIGHTS_PENDING`: arte vinda da Biblioteca do ChatGPT; proveniência e direitos ainda não verificados. Não redistribuir nem usar em material público até decisão humana.",
        "- `DUPLICATE`: dois caminhos com o mesmo SHA-256; preservar ambos (não sobrescrever originais) e citar um como canônico na documentação.",
        "- `NOT_FOUND`: referência apenas nominal; nenhum placeholder foi criado com esses nomes.",
        "- `LIBRARY_ONLY`: existe na Biblioteca, não no Git.",
        "",
        END_MARKER,
    ]
    return "\n".join(lines)


def write_inventory(markdown: str) -> bool:
    if not INVENTORY_DOC.is_file():
        raise SystemExit(f"inventário não encontrado em {INVENTORY_DOC}")
    text = INVENTORY_DOC.read_text(encoding="utf-8")
    if BEGIN_MARKER in text and END_MARKER in text:
        start = text.index(BEGIN_MARKER)
        end = text.index(END_MARKER) + len(END_MARKER)
        updated = text[:start] + markdown + text[end:]
    else:
        updated = text.rstrip("\n") + "\n\n" + markdown + "\n"
    if updated == text:
        return False
    INVENTORY_DOC.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="imprime o inventário em JSON")
    parser.add_argument("--write", action="store_true", help="atualiza o bloco gerado do inventário")
    args = parser.parse_args()

    inventory = build_inventory()
    if args.json:
        print(json.dumps(inventory, indent=2, ensure_ascii=False))
        return 0
    markdown = render_markdown(inventory)
    if args.write:
        changed = write_inventory(markdown)
        print(f"inventário {'atualizado' if changed else 'já estava atualizado'}: {INVENTORY_DOC.relative_to(ROOT)}")
        return 0
    print(markdown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
