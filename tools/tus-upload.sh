#!/usr/bin/env bash
# Upload files to the Hostinger site (public_html) over TUS.
#
# 1. Ask Claude to run the Hostinger operation hosting_files_generate-upload-url
#    (it returns a url, auth_key and rest_auth_key valid for about six hours).
# 2. Export them, then run this script from the folder that holds the files:
#
#      export TUS_URL=... TUS_AUTH=... TUS_REST=...
#      tools/tus-upload.sh <dest-dir-under-public_html> <file> [<file> ...]
#
#    Example (theme files, paths relative to the theme folder):
#      cd theme/wifi-pro
#      ../../tools/tus-upload.sh wp-content/themes/wifi-pro functions.php templates/single.html
#
# Prints "<create>/<upload> <file>"; success is 201/204.
set -euo pipefail

: "${TUS_URL:?set TUS_URL}" "${TUS_AUTH:?set TUS_AUTH}" "${TUS_REST:?set TUS_REST}"
dest_dir="${1:?destination directory under public_html}"; shift

for f in "$@"; do
  size=$(stat -c%s "$f")
  dest="$dest_dir/$f"
  c1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TUS_URL/$dest?override=true" \
        -H "X-Auth: $TUS_AUTH" -H "X-Auth-Rest: $TUS_REST" -H "Tus-Resumable: 1.0.0" \
        -H "Upload-Length: $size" -H "Upload-Offset: 0")
  c2=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$TUS_URL/$dest?override=true" \
        -H "X-Auth: $TUS_AUTH" -H "X-Auth-Rest: $TUS_REST" -H "Tus-Resumable: 1.0.0" \
        -H "Content-Type: application/offset+octet-stream" -H "Upload-Offset: 0" \
        --data-binary "@$f")
  echo "$c1/$c2 $f"
done
