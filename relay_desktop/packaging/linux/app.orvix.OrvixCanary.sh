#!/bin/sh

export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
export ORVIX_FLATPAK_COMMAND="${FLATPAK_ID}"

exec zypak-wrapper "/app/orvix/orvix-canary" "$@"
