#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/sign_apk.sh <unsigned-apk> <keystore> <alias> <storepass> <keypass>
# Requires: zipalign and apksigner available in PATH (from Android build-tools)

INPUT_APK=${1:-}
KEYSTORE=${2:-}
ALIAS=${3:-}
STOREPASS=${4:-}
KEYPASS=${5:-}

if [ -z "$INPUT_APK" ] || [ -z "$KEYSTORE" ] || [ -z "$ALIAS" ] || [ -z "$STOREPASS" ] || [ -z "$KEYPASS" ]; then
  echo "Usage: $0 <unsigned-apk> <keystore> <alias> <storepass> <keypass>"
  exit 2
fi

if ! command -v zipalign >/dev/null 2>&1; then
  echo "zipalign not found in PATH. Ensure Android build-tools are installed and in PATH."
  exit 2
fi

if ! command -v apksigner >/dev/null 2>&1; then
  echo "apksigner not found in PATH. Ensure Android build-tools are installed and in PATH."
  exit 2
fi

TMP_ALIGNED="aligned-$(basename "$INPUT_APK")"
OUTPUT="signed-$(basename "$INPUT_APK")"

echo "Aligning APK..."
zipalign -v -p 4 "$INPUT_APK" "$TMP_ALIGNED"

echo "Signing APK..."
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --ks-pass pass:"$STOREPASS" --key-pass pass:"$KEYPASS" --out "$OUTPUT" "$TMP_ALIGNED"

echo "Verifying signature..."
apksigner verify "$OUTPUT"

echo "Signed APK: $OUTPUT"
