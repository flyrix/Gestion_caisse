#!/usr/bin/env bash
set -euo pipefail

mkdir -p icons

if [ -f icons/icon-192.png.base64 ]; then
  base64 --decode icons/icon-192.png.base64 > icons/icon-192.png
  echo "Wrote icons/icon-192.png"
else
  echo "icons/icon-192.png.base64 not found"
fi

if [ -f icons/icon-512.png.base64 ]; then
  base64 --decode icons/icon-512.png.base64 > icons/icon-512.png
  echo "Wrote icons/icon-512.png"
else
  echo "icons/icon-512.png.base64 not found"
fi

echo "Done. Remember to reference icons/icon-192.png and icons/icon-512.png in manifest.json"
