#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/build_twa.sh <manifestUrl> <packageId> [keystore.jks]

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

# --- Extraction du domaine depuis l'URL ---
DOMAINE=$(echo "$MANIFEST_URL" | sed 's|https://||' | sed 's|/.*||')
BASE_URL="https://$DOMAINE"

# --- Détection automatique de l'icône depuis le manifest PWA ---
echo "Récupération de l'icône depuis $MANIFEST_URL ..."
ICON_URL=$(curl -s "$MANIFEST_URL" | python3 -c "
import json, sys
m = json.load(sys.stdin)
icons = m.get('icons', [])
big = [i for i in icons if '512' in i.get('sizes', '')]
src = (big or icons)[0]['src'] if icons else '/icon-512x512.png'
print(src)
")
[[ "$ICON_URL" != http* ]] && ICON_URL="$BASE_URL/$ICON_URL"
echo "Icône : $ICON_URL"

# --- Génération directe du twa-manifest.json (sans bubblewrap init) ---
if [ -f "twa-manifest.json" ]; then
  echo "twa-manifest.json existant détecté, réutilisation."
else
  echo "Génération du twa-manifest.json..."
  cat > twa-manifest.json << MANIFEST
{
  "packageId": "$PACKAGE_ID",
  "host": "$DOMAINE",
  "name": "Gestion de Caisse",
  "launcherName": "GestionCaisse",
  "display": "standalone",
  "orientation": "default",
  "themeColor": "#FFFFFF",
  "navigationColor": "#000000",
  "navigationColorDark": "#000000",
  "navigationDividerColor": "#000000",
  "navigationDividerColorDark": "#000000",
  "backgroundColor": "#FFFFFF",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "$ICON_URL",
  "maskableIconUrl": "$ICON_URL",
  "monochromeIconUrl": "$ICON_URL",
  "appVersion": "1.0.0",
  "appVersionCode": 1,
  "signingKey": {
    "path": "${KEYSTORE_PATH:-release-keystore.jks}",
    "alias": "release"
  },
  "additionalTrustedOrigins": [],
  "retainedBundles": [],
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "$BASE_URL/",
  "minSdkVersion": 19,
  "fingerprints": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "$MANIFEST_URL",
  "fallbackType": "customtabs",
  "splashScreenFadeOutDuration": 300,
  "shortcutItems": [],
  "features": {},
  "alphaDependencies": { "enabled": false }
}
MANIFEST
  echo "twa-manifest.json généré."
fi

cat twa-manifest.json

# --- Compilation ---
if [ -n "$KEYSTORE_PATH" ] && [ -f "$KEYSTORE_PATH" ]; then
  echo "Building release APK avec keystore : $KEYSTORE_PATH"
  bubblewrap build \
    --keystorePath="$KEYSTORE_PATH" \
    --yes
else
  echo "Building debug APK (pas de keystore fourni)."
  bubblewrap build --debug --yes
fi

echo "Build terminé. APK dans le dossier 'output' ou 'build'."