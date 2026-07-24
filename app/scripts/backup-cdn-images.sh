#!/usr/bin/env bash
set -euo pipefail

image_root="${1:-/srv/services/cdn/blogimages}"

if [[ "$image_root" != /srv/services/cdn/blogimages* ]]; then
	printf 'Refusing to back up a path outside /srv/services/cdn/blogimages.\n' >&2
	exit 1
fi

command -v restic >/dev/null || {
	printf 'restic is not installed. Install it before enabling this backup.\n' >&2
	exit 1
}

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY to a separate off-site repository.}"
: "${RESTIC_PASSWORD_FILE:?Set RESTIC_PASSWORD_FILE to a protected password file.}"

restic backup "$image_root" --tag blogimages
restic forget --tag blogimages --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune
restic check
