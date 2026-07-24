import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { publicPostSlug } from '../src/lib/postRoutes';
import { resolveMediaOverride } from '../src/lib/storyMetadata';

const CDN_ORIGIN = 'https://cdn.nickesselman.nl';
const postsDirectory = path.join(process.cwd(), 'src', 'posts');
const mediaPattern = /!\[[^\]]*\]\(([^)]+)\)(?:\{[^}]*\})?/g;
const rasterPattern = /\.(?:jpe?g|png|webp)$/i;
const paths = new Set<string>();

for (const filename of fs.readdirSync(postsDirectory).filter((file) => file.endsWith('.md'))) {
	const sourceSlug = filename.replace(/\.md$/, '');
	const slug = publicPostSlug(sourceSlug);
	const source = fs.readFileSync(path.join(postsDirectory, filename), 'utf8');
	const frontmatter = matter(source).data;
	if (typeof frontmatter.coverImage === 'string' && rasterPattern.test(frontmatter.coverImage)) {
		paths.add(frontmatter.coverImage);
	}
	for (const match of source.matchAll(mediaPattern)) {
		const rawPath = match[1].trim();
		const override = resolveMediaOverride(slug, rawPath, 'en');
		if (!override?.suppress && rasterPattern.test(override?.replacement || rawPath)) {
			paths.add(override?.replacement || rawPath);
		}
	}
}

const urls = [...paths].flatMap((mediaPath) => {
	const absolute = new URL(mediaPath, CDN_ORIGIN);
	const base = absolute.href.replace(/\.(?:jpe?g|png|webp)$/i, '');
	return [
		absolute.href,
		`${base}-w480.webp`,
		`${base}-w960.webp`,
		`${base}-w1600.webp`
	];
});

const failures: string[] = [];
let cursor = 0;
const worker = async () => {
	while (cursor < urls.length) {
		const url = urls[cursor++];
		try {
			const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
			if (!response.ok) failures.push(`${response.status} ${url}`);
		} catch (error) {
			failures.push(`${error instanceof Error ? error.message : 'request failed'} ${url}`);
		}
	}
};

await Promise.all(Array.from({ length: 12 }, worker));

if (failures.length) {
	console.error(`CDN verification failed for ${failures.length} URL(s):`);
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log(`CDN verification passed for ${urls.length} original and responsive image URLs.`);
