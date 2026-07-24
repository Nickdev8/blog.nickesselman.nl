#!/usr/bin/env bash
set -u

image_root="${1:-/srv/services/cdn/blogimages}"
widths=(480 960 1600)
converted=0
failed=0

while IFS= read -r -d '' source; do
	case "$source" in
		*-w480.webp|*-w960.webp|*-w1600.webp) continue ;;
	esac

	for width in "${widths[@]}"; do
		output="${source%.*}-w${width}.webp"
		[[ -f "$output" ]] && continue
		temporary="${output}.tmp.webp"

		if ffmpeg -nostdin -y -loglevel error -i "$source" \
			-vf "scale=min\\(iw\\,${width}\\):-2" \
			-frames:v 1 -c:v libwebp -quality 80 -compression_level 4 "$temporary"; then
			mv "$temporary" "$output"
			((converted += 1))
		else
			rm -f "$temporary"
			printf 'Failed: %s\n' "$source" >&2
			((failed += 1))
		fi
	done
done < <(
	find "$image_root" -type f \
		\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
		-print0
)

printf 'Created %d responsive variants; %d conversions failed.\n' "$converted" "$failed"
