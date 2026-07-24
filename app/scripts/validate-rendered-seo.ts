import { spawn } from 'node:child_process';
import { STORY_METADATA } from '../src/lib/storyMetadata';

const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['build/index.js'], {
	cwd: process.cwd(),
	env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'production' },
	stdio: ['ignore', 'pipe', 'pipe']
});

const errors: string[] = [];
const fail = (message: string) => errors.push(message);
const sleep = (milliseconds: number) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForServer = async () => {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			const response = await fetch(origin);
			if (response.ok) return;
		} catch {
			// The production server is still starting.
		}
		await sleep(250);
	}
	throw new Error('Production server did not become ready');
};

const getAttribute = (html: string, tagPattern: RegExp, attribute: string) => {
	const tag = html.match(tagPattern)?.[0] || '';
	return tag.match(new RegExp(`${attribute}="([^"]*)"`))?.[1] || '';
};

try {
	await waitForServer();
	const storyRoutes = Object.keys(STORY_METADATA).flatMap((slug) => [`/${slug}`, `/nl/${slug}`]);
	const routes = ['/', '/about', '/nl', '/nl/about', ...storyRoutes];

	for (const route of routes) {
		const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
		if (response.status !== 200) {
			fail(`${route} returned ${response.status}`);
			continue;
		}
		const html = await response.text();
		const expectedLanguage = route === '/nl' || route.startsWith('/nl/') ? 'nl' : 'en';
		if (!html.includes(`<html lang="${expectedLanguage}"`)) fail(`${route} has the wrong lang`);
		if (!/<title>[^<]{10,}<\/title>/.test(html)) fail(`${route} has no useful title`);
		if (!/<meta name="description" content="[^"]{80,}"/.test(html)) {
			fail(`${route} has no useful description`);
		}
		if (!/<link rel="canonical" href="https:\/\/blog\.nickesselman\.nl/.test(html)) {
			fail(`${route} has no canonical`);
		}
		if (!/<h1(?:\s[^>]*)?>/.test(html)) fail(`${route} has no H1`);
		if (html.includes('{@html') || html.includes('%sveltekit.')) {
			fail(`${route} contains an unrendered template token`);
		}
		const jsonLdBlocks = [
			...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
		];
		if (!jsonLdBlocks.length) fail(`${route} has no JSON-LD`);
		for (const block of jsonLdBlocks) {
			try {
				JSON.parse(block[1]);
			} catch {
				fail(`${route} contains invalid JSON-LD`);
			}
		}
		for (const image of html.matchAll(/<img\b[^>]*>/g)) {
			const alt = getAttribute(image[0], /<img\b[^>]*>/, 'alt');
			if (/^(?:alt text|image|photo|extra image)$/i.test(alt)) {
				fail(`${route} contains generic image alt text`);
			}
		}
		if (html.includes('href="http://')) fail(`${route} contains an insecure HTTP link`);
		if (html.includes('nick.hackclub.app/canopy/build')) fail(`${route} contains a dead project link`);
	}

	const legacy = await fetch(`${origin}/moonshot`, { redirect: 'manual' });
	if (legacy.status !== 308 || legacy.headers.get('location') !== '/florida') {
		fail('/moonshot is not a 308 redirect to /florida');
	}

	for (const resource of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
		const response = await fetch(`${origin}${resource}`);
		if (!response.ok) fail(`${resource} returned ${response.status}`);
		const contentType = response.headers.get('content-type') || '';
		if (resource.endsWith('.txt') && !contentType.includes('text/plain')) {
			fail(`${resource} has incorrect content type ${contentType}`);
		}
		if (resource.endsWith('.xml') && !contentType.includes('application/xml')) {
			fail(`${resource} has incorrect content type ${contentType}`);
		}
	}

	const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
	for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
		const pathname = new URL(match[1]).pathname;
		const response = await fetch(`${origin}${pathname}`, { redirect: 'manual' });
		if (response.status !== 200) fail(`Sitemap URL ${pathname} returned ${response.status}`);
	}
} finally {
	server.kill('SIGTERM');
}

if (errors.length) {
	console.error(`Rendered SEO validation failed with ${errors.length} issue(s):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log('Rendered SEO validation passed for all canonical English and Dutch routes.');
