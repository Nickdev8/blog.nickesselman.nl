import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ImmichAsset = {
	id: string;
	type: 'IMAGE' | 'VIDEO' | string;
	originalFileName?: string;
	exifInfo?: {
		exifImageWidth?: number;
		exifImageHeight?: number;
		description?: string;
	};
};

type ImmichSharedLinkResponse = {
	key?: string;
	type: 'ALBUM' | 'INDIVIDUAL' | string;
	allowDownload?: boolean;
	album?: { id: string } | null;
	assets?: ImmichAsset[];
};

type ImmichAlbumResponse = {
	assets?: ImmichAsset[];
	assetCount?: number;
};

type ImmichTimelineBucket = {
	id: string[];
	isImage: boolean[];
};

const invalidResponse = () => json({ error: 'Unable to load Immich data.' }, { status: 502 });
const IMMICH_ORIGIN = 'https://photos.nickesselman.nl';

const extractShareParams = (shareUrl: string) => {
	const parsed = new URL(shareUrl);
	if (
		parsed.hostname !== new URL(IMMICH_ORIGIN).hostname ||
		!['http:', 'https:'].includes(parsed.protocol) ||
		parsed.port ||
		parsed.username ||
		parsed.password
	) {
		throw new Error('Unsupported Immich origin.');
	}
	const segments = parsed.pathname.split('/').filter(Boolean);

	let slug: string | undefined;
	let key: string | undefined;

	if (segments.length >= 2 && segments[0] === 's') {
		slug = decodeURIComponent(segments[1]);
	} else if (segments.length >= 2 && segments[0] === 'share') {
		key = decodeURIComponent(segments[1]);
	} else if (segments.length >= 1) {
		key = decodeURIComponent(segments[segments.length - 1]);
	}

	return {
		slug,
		key,
	};
};

const buildAssetPayload = (key: string, assets: ImmichAsset[], allowDownload: boolean) => {
	return assets.map((asset) => {
		const query = `key=${encodeURIComponent(key)}`;
		const assetUrl = `${IMMICH_ORIGIN}/api/assets/${encodeURIComponent(asset.id)}`;
		const previewUrl = `${assetUrl}/thumbnail?${query}&size=preview`;
		const isVideo = asset.type === 'VIDEO';
		const originalUrl = isVideo
			? `${assetUrl}/video/playback?${query}`
			: allowDownload
				? `${assetUrl}/original?${query}`
				: previewUrl;

		return {
			id: asset.id,
			type: asset.type,
			isVideo,
			alt: asset.exifInfo?.description || asset.originalFileName || 'Immich media',
			width: asset.exifInfo?.exifImageWidth ?? null,
			height: asset.exifInfo?.exifImageHeight ?? null,
			previewUrl,
			originalUrl
		};
	});
};

const fetchImmichJson = async <T>(requestFetch: typeof fetch, url: string): Promise<T> => {
	const response = await requestFetch(url, { redirect: 'error', signal: AbortSignal.timeout(8_000) });
	if (!response.ok) throw new Error(`Immich returned ${response.status}.`);
	return response.json();
};

const loadTimelineAssets = async (
	requestFetch: typeof fetch,
	albumId: string,
	key: string
): Promise<ImmichAsset[]> => {
	const params = new URLSearchParams({ albumId, key });
	const buckets = await fetchImmichJson<{ timeBucket: string }[]>(
		requestFetch,
		`${IMMICH_ORIGIN}/api/timeline/buckets?${params}`
	);
	const assets: ImmichAsset[] = [];
	for (const { timeBucket } of buckets) {
		params.set('timeBucket', timeBucket);
		const bucket = await fetchImmichJson<ImmichTimelineBucket>(
			requestFetch,
			`${IMMICH_ORIGIN}/api/timeline/bucket?${params}`
		);
		assets.push(...bucket.id.map((id, index) => ({
			id,
			type: bucket.isImage[index] ? 'IMAGE' : 'VIDEO'
		})));
	}
	return assets;
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	const shareUrl = url.searchParams.get('shareUrl');

	if (!shareUrl) {
		return json({ error: 'Missing shareUrl parameter.' }, { status: 400 });
	}

	let parsedShare: ReturnType<typeof extractShareParams>;
	try {
		parsedShare = extractShareParams(shareUrl);
	} catch (error) {
		return json({ error: 'Invalid share URL provided.' }, { status: 400 });
	}

	const { slug, key: keyFromPath } = parsedShare;
	const params = new URLSearchParams();

	if (slug) {
		params.set('slug', slug);
	} else if (keyFromPath) {
		params.set('key', keyFromPath);
	} else {
		return json({ error: 'Unable to determine share identifier.' }, { status: 400 });
	}

	try {
		const sharedLink = await fetchImmichJson<ImmichSharedLinkResponse>(
			fetch,
			`${IMMICH_ORIGIN}/api/shared-links/me?${params}`
		);
		const shareKey = sharedLink.key || keyFromPath;

		if (!shareKey) {
			return invalidResponse();
		}

		let assets: ImmichAsset[] = sharedLink.assets || [];

		if (assets.length === 0 && sharedLink.type === 'ALBUM' && sharedLink.album?.id) {
			const albumId = sharedLink.album.id;
			const album = await fetchImmichJson<ImmichAlbumResponse>(
				fetch,
				`${IMMICH_ORIGIN}/api/albums/${encodeURIComponent(albumId)}?key=${encodeURIComponent(shareKey)}`
			);
			// Older versions include assets with the album. Newer versions list them in the timeline.
			assets = album.assets ?? [];
			if (!assets.length && (album.assetCount ?? 0) > 0) {
				assets = await loadTimelineAssets(fetch, albumId, shareKey);
			}
		}

		const payload = buildAssetPayload(shareKey, assets, sharedLink.allowDownload !== false);

		return json({ assets: payload });
	} catch (error) {
		console.error('Immich gallery lookup failed:', error instanceof Error ? error.name : 'Unknown error');
		return invalidResponse();
	}
};
