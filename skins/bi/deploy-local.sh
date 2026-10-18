#!/usr/bin/env bash
# Applies the BI skin to the running local Docker stack, or removes it.
#
#   skins/bi/deploy-local.sh apply      copy the skin in and patch BI's index.html
#   skins/bi/deploy-local.sh rollback   restore BI's original index.html, remove the skin
#
# BI (packages/legacy) is prebuilt into the image and is not bind-mounted like the
# other apps, so this copies into the container. A container that is recreated
# (not just restarted) loses the change; run `apply` again.
set -euo pipefail

CONTAINER="${SEMOSS_CONTAINER:-semoss}"
LEGACY="/opt/apache-tomcat-11.0.26/webapps/SemossWeb/packages/legacy"
HERE="$(cd "$(dirname "$0")" && pwd)"

case "${1:-}" in
apply)
	# A short hash of the skin files in the URL stops browsers serving a stale copy.
	version="$(cat "$HERE/bi-skin.css" "$HERE/bi-skin.js" | shasum | cut -c1-8)"
	patched="$(mktemp)"
	trap 'rm -f "$patched"' EXIT
	sed \
		-e "s#</head>#<script src=\"../skin/bi-skin.js?v=${version}\"></script></head>#" \
		-e "s#\(<link href=\"core\.[^\"]*\" rel=\"stylesheet\">\)#\1<link id=\"bi-skin-css\" href=\"../skin/bi-skin.css?v=${version}\" rel=\"stylesheet\">#" \
		"$HERE/index.original.html" >"$patched"
	grep -q "bi-skin-css" "$patched" || { echo "could not patch index.html" >&2; exit 1; }
	# mktemp makes the file owner-only; Tomcat runs as another user and needs to read it.
	chmod 644 "$patched"

	docker exec "$CONTAINER" mkdir -p "$LEGACY/skin/fonts"
	docker cp "$HERE/bi-skin.css" "$CONTAINER:$LEGACY/skin/bi-skin.css"
	docker cp "$HERE/bi-skin.js" "$CONTAINER:$LEGACY/skin/bi-skin.js"
	docker cp "$HERE/fonts/." "$CONTAINER:$LEGACY/skin/fonts/"
	docker cp "$patched" "$CONTAINER:$LEGACY/dist/index.html"
	# docker cp keeps the host's owner and mode; make everything readable by the server.
	docker exec -u root "$CONTAINER" sh -c "chmod -R a+rX '$LEGACY/skin' && chmod 644 '$LEGACY/dist/index.html'"
	echo "BI skin applied (version ${version})."
	;;
rollback)
	docker cp "$HERE/index.original.html" "$CONTAINER:$LEGACY/dist/index.html"
	docker exec -u root "$CONTAINER" chmod 644 "$LEGACY/dist/index.html"
	docker exec "$CONTAINER" rm -rf "$LEGACY/skin"
	echo "BI skin removed."
	;;
*)
	echo "usage: $0 apply|rollback" >&2
	exit 2
	;;
esac
