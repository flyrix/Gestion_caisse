#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/build_twa.sh <manifestUrl> <packageId> [keystore.jks]
# Example: ./scripts/build_twa.sh https://example.com/manifest.json com.example.caisse release-keystore.jks

MANIFEST_URL=${1:-}
PACKAGE_ID=${2:-}
KEYSTORE_PATH=${3:-}

if [ -z "$MANIFEST_URL" ] || [ -z "$PACKAGE_ID" ]; then
  echo "Usage: $0 <manifestUrl> <packageId> [keystore.jks]"
  exit 2
fi

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "bubblewrap not found. Install with: npm install -g @bubblewrap/cli"
  exit 2
fi

echo "Initialisation TWA..."
if [ -f "twa-manifest.json" ]; then
  echo "Fichier twa-manifest.json existant détecté, utilisation du fichier existant."
else
  bubblewrap init --manifestUrl="$MANIFEST_URL" --packageId="$PACKAGE_ID" --appVersionName=1.0.0 --appVersionCode=1 --display=standalone
fi

if [ -n "$KEYSTORE_PATH" ]; then
  echo "Building release APK with keystore $KEYSTORE_PATH"
  bubblewrap build --keystorePath="$KEYSTORE_PATH"
else
  echo "Building debug APK (no keystore provided)"
  bubblewrap build --debug
fi

echo "Build terminé. Vérifiez le dossier 'output' ou 'build' généré par bubblewrap."
