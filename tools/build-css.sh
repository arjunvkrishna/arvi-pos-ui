#!/usr/bin/env bash
# Compiles tailwind.css from the classes used in the HTML/JS. Run after adding or changing any Tailwind class,
# then commit tailwind.css. tools/check-css.sh (run by the release checks) fails if the file is stale.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -x tools/node_modules/.bin/tailwindcss ] || (cd tools && npm install --no-audit --no-fund --silent)
tools/node_modules/.bin/tailwindcss -c tools/tailwind.config.js -i tools/tailwind.input.css -o "${1:-tailwind.css}" --minify
echo "tailwind.css: $(wc -c < "${1:-tailwind.css}") bytes"
