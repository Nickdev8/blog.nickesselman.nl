import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const shareUrl = args.get('--share-url');
const story = args.get('--story');
const sshHost = args.get('--ssh-host') || 'nick';
const cdnRoot = args.get('--cdn-root') || '/srv/services/cdn/blogimages';
const cdnOrigin = (args.get('--cdn-origin') || 'https://cdn.nickesselman.nl').replace(/\/$/, '');

if (!shareUrl || !story) {
	console.error(
		'Usage: node scripts/snapshot-immich-album.mjs --share-url <url> --story <slug> [--ssh-host nick]'
	);
	process.exit(1);
}
if (!/^[a-z0-9_-]+$/.test(story)) {
	console.error('Story must contain only lowercase letters, numbers, underscores, or hyphens.');
	process.exit(1);
}
if (!/^[a-zA-Z0-9_.@-]+$/.test(sshHost)) {
	console.error('SSH host contains unsupported characters.');
	process.exit(1);
}
if (!/^\/srv\/services\/cdn\/blogimages(?:\/[a-zA-Z0-9._-]+)*$/.test(cdnRoot)) {
	console.error('CDN root must stay inside /srv/services/cdn/blogimages.');
	process.exit(1);
}

const run = (command, commandArgs, options = {}) =>
	new Promise((resolve, reject) => {
		const child = spawn(command, commandArgs, {
			stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit'
		});
		if (options.input) child.stdin.end(options.input);
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code}`))
		);
	});

const extractShare = (value) => {
	const parsed = new URL(value);
	const segments = parsed.pathname.split('/').filter(Boolean);
	if (segments[0] === 's' && segments[1]) {
		return { origin: parsed.origin, slug: decodeURIComponent(segments[1]) };
	}
	if (segments[0] === 'share' && segments[1]) {
		return { origin: parsed.origin, key: decodeURIComponent(segments[1]) };
	}
	if (segments.length) {
		return { origin: parsed.origin, key: decodeURIComponent(segments.at(-1)) };
	}
	throw new Error('Unable to determine the Immich share identifier.');
};

const safeExtension = (filename, type) => {
	const extension = path.extname(filename || '').toLowerCase();
	if (/^\.[a-z0-9]{1,8}$/.test(extension)) return extension;
	return type === 'VIDEO' ? '.mp4' : '.jpg';
};

const getJson = async (url) => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} while requesting ${url}`);
	return response.json();
};

const hashFile = (filename) =>
	new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		const stream = fs.createReadStream(filename);
		stream.on('data', (chunk) => hash.update(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolve(hash.digest('hex').slice(0, 12)));
	});

const parsedShare = extractShare(shareUrl);
const shareParams = new URLSearchParams();
if (parsedShare.slug) shareParams.set('slug', parsedShare.slug);
else shareParams.set('key', parsedShare.key);

const sharedLink = await getJson(
	`${parsedShare.origin}/api/shared-links/me?${shareParams.toString()}`
);
const shareKey = sharedLink.key || parsedShare.key;
if (!shareKey) throw new Error('Immich did not return a usable share key.');

let assets = Array.isArray(sharedLink.assets) ? sharedLink.assets : [];
if (!assets.length && sharedLink.type === 'ALBUM' && sharedLink.album?.id) {
	const album = await getJson(
		`${parsedShare.origin}/api/albums/${sharedLink.album.id}?key=${encodeURIComponent(shareKey)}`
	);
	assets = Array.isArray(album.assets) ? album.assets : [];
}
if (!assets.length) throw new Error('The shared album contains no assets.');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), `immich-${story}-`));
const albumDirectory = path.join(temporaryRoot, 'album');
fs.mkdirSync(albumDirectory);

try {
	const manifestAssets = [];
	for (const [index, asset] of assets.entries()) {
		const extension = safeExtension(asset.originalFileName, asset.type);
		const temporaryFilename = `${asset.id}.download`;
		const temporaryPath = path.join(albumDirectory, temporaryFilename);
		const originalUrl = `${parsedShare.origin}/api/assets/${asset.id}/original?key=${encodeURIComponent(shareKey)}`;
		const response = await fetch(originalUrl);
		if (!response.ok || !response.body) {
			throw new Error(`${response.status} while downloading ${asset.originalFileName || asset.id}`);
		}
		await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath));
		const contentHash = await hashFile(temporaryPath);
		const filename = `${asset.id}-${contentHash}${extension}`;
		const localPath = path.join(albumDirectory, filename);
		fs.renameSync(temporaryPath, localPath);

		const publicBase = `${cdnOrigin}/blogimages/${story}/album/${filename}`;
		const responsiveBase = publicBase.replace(/\.[^.]+$/, '');
		const isVideo = asset.type === 'VIDEO';
		if (isVideo) {
			await run('ffmpeg', [
				'-nostdin',
				'-y',
				'-loglevel',
				'error',
				'-i',
				localPath,
				'-frames:v',
				'1',
				'-vf',
				'scale=min(iw\\,960):-2',
				'-c:v',
				'libwebp',
				'-quality',
				'78',
				`${localPath.replace(/\.[^.]+$/, '')}-poster-w960.webp`
			]);
		}
		manifestAssets.push({
			id: asset.id,
			alt: asset.exifInfo?.description || asset.originalFileName || `Media ${index + 1}`,
			isVideo,
			width: asset.exifInfo?.exifImageWidth || null,
			height: asset.exifInfo?.exifImageHeight || null,
			previewUrl: isVideo ? `${responsiveBase}-poster-w960.webp` : `${responsiveBase}-w960.webp`,
			originalUrl: publicBase,
			srcset: isVideo
				? null
				: [480, 960, 1600]
						.map((width) => `${responsiveBase}-w${width}.webp ${width}w`)
						.join(', ')
		});
		console.log(`Downloaded ${index + 1}/${assets.length}: ${asset.originalFileName || asset.id}`);
	}

	fs.writeFileSync(
		path.join(albumDirectory, 'manifest.json'),
		`${JSON.stringify(
			{
				version: 1,
				generatedAt: new Date().toISOString(),
				story,
				assets: manifestAssets
			},
			null,
			2
		)}\n`
	);

	const remoteDirectory = `${cdnRoot}/${story}/album`;
	await run('ssh', [sshHost, 'mkdir', '-p', remoteDirectory]);
	await run('rsync', [
		'-a',
		'--checksum',
		'--exclude',
		'manifest.json',
		`${albumDirectory}/`,
		`${sshHost}:${remoteDirectory}/`
	]);

	const optimizer = fs.readFileSync(new URL('./optimize-cdn-images.sh', import.meta.url), 'utf8');
	await run('ssh', [sshHost, 'bash', '-s', '--', remoteDirectory], { input: optimizer });
	await run('rsync', [
		'-a',
		'--checksum',
		path.join(albumDirectory, 'manifest.json'),
		`${sshHost}:${remoteDirectory}/`
	]);

	console.log(`Published ${manifestAssets.length} assets to ${remoteDirectory}`);
	console.log(
		`Set ${story.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_GALLERY_MANIFEST_URL=${cdnOrigin}/blogimages/${story}/album/manifest.json`
	);
} finally {
	fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
