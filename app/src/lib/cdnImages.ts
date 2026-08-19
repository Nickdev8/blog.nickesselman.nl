import mediaManifest from '../data/media-manifest.json';

const CDN_IMAGE_PATTERN = /^https:\/\/cdn\.nickesselman\.nl\/(blogimages\/.+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i;
const RESPONSIVE_WIDTHS = [480, 960, 1600] as const;
const VARIANT_VERSION = '2';
const IMAGE_DIMENSIONS = mediaManifest as Record<string, { width: number; height: number }>;

export const cdnImageSrcset = (src?: string) => {
	if (!src || /-w(?:480|960|1600)\.webp(?:[?#].*)?$/i.test(src)) return undefined;
	const match = src.match(CDN_IMAGE_PATTERN);
	if (!match) return undefined;
	const [, path] = match;
	return RESPONSIVE_WIDTHS.map((width) => `/_image/${width}/${path}?v=${VARIANT_VERSION} ${width}w`).join(', ');
};

export const cdnImageVariant = (
	src: string | undefined,
	width: (typeof RESPONSIVE_WIDTHS)[number]
) => {
	if (!src) return undefined;
	const match = src.match(CDN_IMAGE_PATTERN);
	if (!match) return undefined;
	const [, path] = match;
	return `/_image/${width}/${path}?v=${VARIANT_VERSION}`;
};

export const cdnImageDimensions = (src?: string) => {
	if (!src) return undefined;
	try {
		return IMAGE_DIMENSIONS[new URL(src, 'https://cdn.nickesselman.nl').pathname];
	} catch {
		return undefined;
	}
};
