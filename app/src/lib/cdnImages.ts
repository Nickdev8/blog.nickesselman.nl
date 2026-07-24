const CDN_IMAGE_PATTERN = /^(https:\/\/cdn\.nickesselman\.nl\/.+)\.(?:jpe?g|png|webp)([?#].*)?$/i;
const RESPONSIVE_WIDTHS = [480, 960, 1600] as const;

export const cdnImageSrcset = (src?: string) => {
	if (!src || /-w(?:480|960|1600)\.webp(?:[?#].*)?$/i.test(src)) return undefined;
	const match = src.match(CDN_IMAGE_PATTERN);
	if (!match) return undefined;
	const [, base, suffix = ''] = match;
	return RESPONSIVE_WIDTHS.map((width) => `${base}-w${width}.webp${suffix} ${width}w`).join(', ');
};
