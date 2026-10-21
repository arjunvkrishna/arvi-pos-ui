#!/usr/bin/env bash
# Downloads the third-party browser assets once, verifies them, and stores them under vendor/ so the app
# makes no requests to outside hosts at runtime. Re-run only when upgrading a library (bump the versions below).
set -euo pipefail
cd "$(dirname "$0")/.."
FA=6.5.1; CHART=4.4.1; OUTFIT=1   # directory names carry the version so files can be cached forever; bump when upgrading
CDN=https://cdnjs.cloudflare.com/ajax/libs

mkdir -p "vendor/fontawesome-$FA/css" "vendor/fontawesome-$FA/webfonts" "vendor/chartjs-$CHART" "vendor/outfit-$OUTFIT"
fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }
sri()   { printf 'sha512-%s' "$(openssl dgst -sha512 -binary "$1" | base64 -w0)"; }

# --- Font Awesome Free (icons CSS + the fonts it references) ---
fetch "$CDN/font-awesome/$FA/css/all.min.css" vendor/fontawesome-$FA/css/all.min.css
for f in fa-solid-900 fa-regular-400 fa-brands-400; do
  fetch "$CDN/font-awesome/$FA/webfonts/$f.woff2" "vendor/fontawesome-$FA/webfonts/$f.woff2"
done
# --- Chart.js (loaded on demand by the Analytics tab) ---
fetch "$CDN/Chart.js/$CHART/chart.umd.min.js" vendor/chartjs-$CHART/chart.umd.min.js

# Integrity check against the hashes that index.html already pinned for these exact files.
expect_fa='sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=='
expect_chart='sha512-CQBWl4fJHWbryGE+Pc7UAxWMUMNMWzWxF4SQo9CgkJIN1kx6djDQZjh3Y8SZ1d+6I+1zze6Z7kHXO7q3UyZAWw=='
[ "$(sri vendor/fontawesome-$FA/css/all.min.css)" = "$expect_fa" ]   || { echo "Font Awesome CSS hash mismatch"; exit 1; }
[ "$(sri vendor/chartjs-$CHART/chart.umd.min.js)"     = "$expect_chart" ] || { echo "Chart.js hash mismatch"; exit 1; }
echo "Font Awesome $FA and Chart.js $CHART verified against the pinned SRI hashes."

# --- Outfit font (Google Fonts, SIL Open Font License): fetch the woff2 files and write a local @font-face file ---
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
curl -fsSL --retry 3 -A "$UA" 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap' > "vendor/outfit-$OUTFIT/.google.css"
OUT_DIR="vendor/outfit-$OUTFIT" python3 - "vendor/outfit-$OUTFIT/.google.css" "vendor/outfit-$OUTFIT/outfit.css" <<'PY'
import re, sys, subprocess, os
css = open(sys.argv[1]).read(); out = sys.argv[2]
blocks = re.findall(r'/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})', css, re.S)
seen = {}
with open(out, 'w') as f:
    f.write('/* Outfit (c) The Outfit Project Authors, SIL Open Font License 1.1. Self-hosted copy of the Google Fonts files. */\n')
    for subset, block in blocks:
        if subset not in ('latin', 'latin-ext'):
            continue
        url = re.search(r'url\((https://[^)]+)\)', block).group(1)
        name = 'outfit-%s.woff2' % subset
        if name not in seen:
            subprocess.check_call(['curl', '-fsSL', '--retry', '3', '-o', os.environ['OUT_DIR'] + '/' + name, url])
            seen[name] = True
        block = re.sub(r"url\(https://[^)]+\) format\('woff2'\)", "url('%s') format('woff2')" % name, block)
        f.write('/* %s */\n%s\n' % (subset, block))
print('Outfit: wrote', out, 'with', sorted(seen))
PY
rm -f "vendor/outfit-$OUTFIT/.google.css"
echo "done. vendor/ contents:"; find vendor -type f | sort | xargs ls -la | awk '{printf "  %8d  %s\n",$5,$9}'
