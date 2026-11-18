#!/usr/bin/env bash
# الاستخدام: ./bump.sh "🆕 ملاحظة 1" "ملاحظة 2"
set -e
cd "$(dirname "$0")"
V=$(( $(grep -o '"v": *[0-9]*' version.json | grep -o '[0-9]*') + 1 ))
NOTES=$(printf '"%s",' "$@"); NOTES="[${NOTES%,}]"
echo "{\"v\": $V, \"notes\": $NOTES}" > version.json
sed -i "s/const APP_V = [0-9]*;/const APP_V = $V;/" index.html
sed -i "s/sales-drill-v[0-9]*/sales-drill-v$V/" sw.js
echo "الإصدار بقى $V"
