#!/usr/bin/env bash
# Gera build + .zip na raiz do pacote (manifest.json no primeiro nível — exigência da Chrome Web Store).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extensions/agilize-crm-sidekick"
cd "$ROOT"

echo "==> Instalando dependências e build da extensão..."
npm run build:extension

VERSION="$(node -p "require('$EXT/package.json').version")"
OUT="$EXT/release"
mkdir -p "$OUT"
ZIP="$OUT/agilize-crm-sidekick-v${VERSION}-chrome-webstore.zip"

rm -f "$ZIP"
if command -v zip >/dev/null 2>&1; then
  (cd "$EXT/dist" && zip -r -q "$ZIP" .)
else
  python3 - "$EXT/dist" "$ZIP" << 'PY'
import sys, zipfile, os
dist, outp = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(outp, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(dist):
        for f in files:
            path = os.path.join(root, f)
            arc = os.path.relpath(path, dist)
            z.write(path, arc)
PY
fi

echo ""
echo "Pacote pronto para enviar à Chrome Web Store:"
echo "  $ZIP"
ls -la "$ZIP"
