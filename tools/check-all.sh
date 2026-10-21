#!/usr/bin/env bash
# One-command frontend release check. Run it before building the images:  neram-pos-frontend/tools/check-all.sh
# Fails (non-zero exit) if anything that would break or silently degrade the app is out of date.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(cd .. && pwd); fail=0
ok()  { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

echo "1. JavaScript syntax (core + every on-demand file + service worker)"
for f in app.js js/*.js sw.js; do node --check "$f" 2>/dev/null || bad "syntax error in $f"; done; [ $fail -eq 0 ] && ok "all files parse"

echo "2. On-demand module registry and rules (tools/check-chunks.js)"
[ -d tools/node_modules ] || (cd tools && npm install --no-audit --no-fund --silent)
node tools/check-chunks.js >/tmp/check-chunks.out 2>&1 && ok "$(tail -1 /tmp/check-chunks.out)" || { bad "chunk check failed"; cat /tmp/check-chunks.out | sed 's/^/        /'; }

echo "3. Compiled Tailwind CSS is up to date"
tmp=$(mktemp); ./tools/build-css.sh "$tmp" >/dev/null 2>&1
if cmp -s "$tmp" tailwind.css; then ok "tailwind.css matches the classes used in the HTML/JS"; else bad "tailwind.css is stale: run tools/build-css.sh and commit it"; fi; rm -f "$tmp"

echo "4. Versions agree everywhere"
pom=$(sed -n 's#^    <version>\(.*\)</version>#\1#p' "$ROOT/neram-pos-backend/pom.xml" | head -1)
chk() { if [ "$2" = "$pom" ]; then ok "$1 = $2"; else bad "$1 = '$2' but pom.xml = $pom"; fi; }
chk "index.html app.js?v="      "$(grep -o 'app\.js?v=[0-9.]*' index.html | head -1 | cut -d= -f2)"
chk "index.html style.css?v="   "$(grep -o 'style\.css?v=[0-9.]*' index.html | head -1 | cut -d= -f2)"
chk "index.html tailwind.css?v=" "$(grep -o 'tailwind\.css?v=[0-9.]*' index.html | head -1 | cut -d= -f2)"
chk "menu.html tailwind.css?v=" "$(grep -o 'tailwind\.css?v=[0-9.]*' menu.html | head -1 | cut -d= -f2)"
chk "sw.js cache name"          "$(grep -o "neram-pos-v[0-9.]*" sw.js | head -1 | sed 's/neram-pos-v//')"
chk "index.html version label"  "$(grep -o '<span>v[0-9.]*</span>' index.html | head -1 | sed 's/<span>v//;s#</span>##')"
chk "docker-compose backend tag" "$(grep -o 'pos-backend:v[0-9.]*' "$ROOT/docker-compose.yml" | head -1 | sed 's/.*:v//')"
chk "docker-compose ui tag"      "$(grep -o 'pos-ui:v[0-9.]*' "$ROOT/docker-compose.yml" | head -1 | sed 's/.*:v//')"
# every precached versioned URL in sw.js must carry the current version
stale=$(grep -oE "\?v=[0-9.]+" sw.js | sort -u | grep -v "?v=$pom" || true); [ -z "$stale" ] && ok "sw.js precache URLs all use v$pom" || bad "sw.js has precache URLs with another version: $stale"

echo "5. Nothing loads from outside hosts, and vendored files exist"
ext=$(grep -ohE '(src|href)="https?://[^"]+"' index.html menu.html | grep -vE 'wa\.me|google\.com/maps|tel:' || true); [ -z "$ext" ] && ok "index.html and menu.html reference no outside hosts" || bad "outside hosts referenced: $ext"
for f in vendor/chartjs-4.4.1/chart.umd.min.js vendor/fontawesome-6.5.1/css/all.min.css vendor/fontawesome-6.5.1/webfonts/fa-solid-900.woff2 vendor/outfit-1/outfit.css; do [ -s "$f" ] || bad "missing $f (run tools/fetch-vendor.sh)"; done; [ $fail -eq 0 ] && ok "vendor files present"

echo
if [ $fail -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $fail
