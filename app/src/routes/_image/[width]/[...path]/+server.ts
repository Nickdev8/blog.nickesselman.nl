import { error } from '@sveltejs/kit';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { RequestHandler } from './$types';

const CDN_ORIGIN = 'https://cdn.nickesselman.nl';
const CACHE_ROOT = '/app/data/image-variants';
const ALLOWED_WIDTHS = new Set(['480', '960', '1600']);
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const pending = new Map<string, Promise<Buffer>>();

const cacheHeaders = {
	'content-type': 'image/jpeg',
	'cache-control': 'public, max-age=31536000, immutable',
	// Do not allow another origin to render this response as an image.
	'cross-origin-resource-policy': 'same-origin',
	// Deliberately omit Access-Control-Allow-Origin: scripts on other origins cannot read it.
	'vary': 'Origin, Sec-Fetch-Site'
};

const isSameOriginBrowserRequest = (request: Request) => {
	const requestOrigin = new URL(request.url).origin;
	const origin = request.headers.get('origin');
	if (origin && origin !== requestOrigin) return false;
	return request.headers.get('sec-fetch-site') !== 'cross-site';
};

const safeImagePath = (rawPath: string) => {
	const segments = rawPath.split('/');
	if (
		!segments.length ||
		segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\')) ||
		segments[0] !== 'blogimages' ||
		!/\.(?:jpe?g|png|webp)$/i.test(segments.at(-1) || '')
	) {
		throw error(404, 'Image not found');
	}
	return segments;
};

const createVariant = async (source: Buffer, width: string) =>
	new Promise<Buffer>((resolve, reject) => {
		const process = spawn('ffmpeg', [
			'-nostdin',
			'-v',
			'error',
			'-i',
			'pipe:0',
			'-vf',
			`scale=min(iw\\,${width}):-2`,
			'-frames:v',
			'1',
			'-c:v',
			'mjpeg',
			'-q:v',
			'3',
			'-f',
			'image2pipe',
			'pipe:1'
		]);
		const chunks: Buffer[] = [];
		let stderr = '';
		process.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
		process.stderr.on('data', (chunk: Buffer) => (stderr += chunk));
		process.on('error', reject);
		process.on('close', (code) => {
			if (code === 0) resolve(Buffer.concat(chunks));
			else reject(new Error(`ffmpeg exited with ${code}: ${stderr}`));
		});
		process.stdin.end(source);
	});

const getVariant = async (sourcePath: string, cachePath: string, width: string) => {
	try {
		return await readFile(cachePath);
	} catch {
		// Generate the local cache entry below.
	}

	const active = pending.get(cachePath);
	if (active) return active;
	const task = (async () => {
		const sourceUrl = `${CDN_ORIGIN}/${sourcePath.split('/').map(encodeURIComponent).join('/')}`;
		const sourceResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
		if (!sourceResponse.ok) throw error(404, 'Image not found');
		const size = Number(sourceResponse.headers.get('content-length') || 0);
		if (size > MAX_SOURCE_BYTES) throw error(413, 'Image is too large to transform');
		const source = Buffer.from(await sourceResponse.arrayBuffer());
		if (source.length > MAX_SOURCE_BYTES) throw error(413, 'Image is too large to transform');
		const variant = await createVariant(source, width);
		await mkdir(path.dirname(cachePath), { recursive: true });
		const temporary = `${cachePath}.${process.pid}.tmp`;
		await writeFile(temporary, variant);
		await rename(temporary, cachePath);
		return variant;
	})();
	pending.set(cachePath, task);
	try {
		return await task;
	} finally {
		pending.delete(cachePath);
	}
};

export const GET: RequestHandler = async ({ params, request }) => {
	if (!isSameOriginBrowserRequest(request)) throw error(403, 'Cross-origin image requests are not allowed');
	if (!ALLOWED_WIDTHS.has(params.width)) throw error(404, 'Image size not found');
	const sourcePath = safeImagePath(params.path);
	// Preserve the original extension: `photo.png` and `photo.webp` can both exist in a story.
	const relativeCachePath = `${sourcePath.join('/')}-w${params.width}.jpg`;
	const cachePath = path.join(CACHE_ROOT, relativeCachePath);
	let variant: Buffer;
	try {
		variant = await getVariant(sourcePath.join('/'), cachePath, params.width);
	} catch (cause) {
		if (typeof cause === 'object' && cause !== null && 'status' in cause) throw cause;
		console.error(`Unable to generate image variant for ${sourcePath.join('/')}`, cause);
		throw error(502, 'Unable to transform image');
	}
	return new Response(new Uint8Array(variant), { headers: cacheHeaders });
};
