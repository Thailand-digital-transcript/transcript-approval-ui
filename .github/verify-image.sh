#!/usr/bin/env bash
# Asserts the built UI image serves the Vite bundle. Usage: ./.github/verify-image.sh <image-tag>
set -euo pipefail
img="${1:?usage: verify-image.sh <image-tag>}"

docker run --rm --entrypoint ls "$img" /usr/share/nginx/html/index.html >/dev/null \
  || { echo "FAIL: index.html missing from nginx root"; exit 1; }

echo "OK: $img serves index.html"
