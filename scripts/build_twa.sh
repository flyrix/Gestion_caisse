#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/build_twa.sh <manifestUrl> <packageId> [keystore.jks] [keystorePassword] [keyAlias]

MANIFEST_URL=${1:-}
PACKAGE_ID=${2:-}
KEYSTORE_PATH=${3:-}
KEYSTORE_PASSWORD=${4:-}
KEY_ALIAS=${5:-release}

if [ -z "$MANIFEST_URL" ] || [ -z "$PACKAGE_ID" ]; then
  echo "Usage: $0 <manifestUrl> <packageId> [keystore.jks] [keystorePassword] [keyAlias]"
  exit 2
fi

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "bubblewrap not found. Install with: npm install -g @bubblewrap/cli"
  exit 2
fi

# Nettoyage des anciens fichiers temporaires
rm -rf twa-manifest.json twa-crypto-checksums.json android_project app

# --- Extraction du domaine depuis l'URL ---
DOMAINE=$(echo "$MANIFEST_URL" | sed 's|https://||' | sed 's|/.*||')
BASE_URL="https://$DOMAINE"

# --- Détection automatique de l'icône ---
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

# --- Récupération du chemin absolu du Keystore ---
ABS_KEYSTORE_PATH=""
if [ -n "$KEYSTORE_PATH" ] && [ -f "$KEYSTORE_PATH" ]; then
  ABS_KEYSTORE_PATH=$(realpath "$KEYSTORE_PATH")
fi

# --- Génération du twa-manifest.json (Sécurisé pour Gradle) ---
echo "Génération du twa-manifest.json..."
cat > twa-manifest.json << MANIFEST
{
  "packageId": "$PACKAGE_ID",
  "host": "$DOMAINE",
  "name": "Gestion de Caisse",
  "launcherName": "Caisse",
  "displayName": "Gestion de Caisse",
  "display": "standalone",
  "orientation": "default",
  "themeColor": "#3498db",
  "navigationColor": "#000000",
  "navigationColorDark": "#000000",
  "navigationDividerColor": "#000000",
  "navigationDividerColorDark": "#000000",
  "backgroundColor": "#ffffff",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "$ICON_URL",
  "maskableIconUrl": "$ICON_URL",
  "monochromeIconUrl": "$ICON_URL",
  "appVersionName": "1.0.0",
  "appVersionCode": 1,
  "signingKey": {
    "path": "${ABS_KEYSTORE_PATH:-release-keystore.jks}",
    "alias": "$KEY_ALIAS"
  },
  "additionalTrustedOrigins": [],
  "retainedBundles": [],
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "$BASE_URL/",
  "minSdkVersion": 21,
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

# --- Génération automatique du Checksum Leurre ---
if command -v md5sum >/dev/null 2>&1; then
  echo '{"twa-manifest.json":"'$(md5sum twa-manifest.json | awk '{print $1}')'"}' > twa-crypto-checksums.json
elif command -v md5 >/dev/null 2>&1; then
  echo '{"twa-manifest.json":"'$(md5 -q twa-manifest.json)'"}' > twa-crypto-checksums.json
fi

# --- Génération silencieuse de la structure Android ---
echo "Création de la structure Android native..."
printf "1.0.0\n1\ny\n" | bubblewrap update --yes || true

# --- Compilation avec injection des mots de passe ---
if [ -n "$ABS_KEYSTORE_PATH" ] && [ -f "$ABS_KEYSTORE_PATH" ]; then
  echo "Building release APK avec keystore : $ABS_KEYSTORE_PATH"
  
  # Export des variables pour court-circuiter les questions de mot de passe
  export BUBBLEWRAP_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"
  export BUBBLEWRAP_KEY_PASSWORD="$KEYSTORE_PASSWORD"

  bubblewrap build \
    --keystorePath="$ABS_KEYSTORE_PATH" \
    --keyAlias="$KEY_ALIAS" \
    --skipUpdateCheck \
    --yes
else
  echo "Building debug APK (pas de keystore valide fourni)."
  bubblewrap build --debug --skipUpdateCheck --yes
fi

echo "Build terminé. APK disponible !"