import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import mediaManifest from '../src/data/media-manifest.json';
import {
	getStoryMetadata,
	resolveMediaOverride,
	STORY_METADATA
} from '../src/lib/storyMetadata';

const postsDirectory = path.join(process.cwd(), 'src', 'posts');
const mediaPattern = /!\[([^\]]*)\]\(([^)]+)\)(?:\{[^}]*\})?/g;
const genericAlt = /^(?:alt text|image|photo|foto|afbeelding|extra image)$/i;
const rasterImage = /\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i;
const errors: string[] = [];

const fail = (message: string) => errors.push(message);

for (const [slug, story] of Object.entries(STORY_METADATA)) {
	for (const locale of ['en', 'nl'] as const) {
		const title = story.title[locale];
		const description = story.description[locale];
		if (title.length < 30 || title.length > 65) {
			fail(`${slug}.${locale} title must be 30–65 characters (found ${title.length})`);
		}
		if (description.length < 120 || description.length > 160) {
			fail(`${slug}.${locale} description must be 120–160 characters (found ${description.length})`);
		}
	}
	if (Number.isNaN(Date.parse(story.publishedTime))) fail(`${slug} has an invalid publishedTime`);
	if (Number.isNaN(Date.parse(story.modifiedTime))) fail(`${slug} has an invalid modifiedTime`);
	if (Date.parse(story.modifiedTime) < Date.parse(story.publishedTime)) {
		fail(`${slug} modifiedTime precedes publishedTime`);
	}
	for (const related of story.related) {
		if (!STORY_METADATA[related]) fail(`${slug} references missing related story ${related}`);
	}
}

const uniqueEnglishTitles = new Set(Object.values(STORY_METADATA).map((story) => story.title.en));
const uniqueEnglishDescriptions = new Set(
	Object.values(STORY_METADATA).map((story) => story.description.en)
);
if (uniqueEnglishTitles.size !== Object.keys(STORY_METADATA).length) fail('English titles are not unique');
if (uniqueEnglishDescriptions.size !== Object.keys(STORY_METADATA).length) {
	fail('English descriptions are not unique');
}

for (const filename of fs.readdirSync(postsDirectory).filter((file) => file.endsWith('.md'))) {
	const sourceSlug = filename.replace(/\.md$/, '');
	const slug = sourceSlug === 'moonshot' ? 'florida' : sourceSlug;
	const metadata = getStoryMetadata(slug);
	if (!metadata) {
		fail(`${filename} has no story metadata`);
		continue;
	}
	const source = fs.readFileSync(path.join(postsDirectory, filename), 'utf8');
	matter(source);
	for (const match of source.matchAll(mediaPattern)) {
		const authoredAlt = match[1].trim();
		const mediaPath = match[2].trim();
		const override = resolveMediaOverride(slug, mediaPath, 'en');
		const effectiveAlt = override?.alt || authoredAlt;
		if (!override?.suppress && (!effectiveAlt || genericAlt.test(effectiveAlt))) {
			fail(`${filename}: weak alt text for ${mediaPath}`);
		}
		if (
			!override?.suppress &&
			rasterImage.test(override?.replacement || mediaPath) &&
			(mediaPath.startsWith('/blogimages/') || override?.replacement?.startsWith('/blogimages/'))
		) {
			const key = new URL(
				override?.replacement || mediaPath,
				'https://cdn.nickesselman.nl'
			).pathname;
			if (!(key in mediaManifest)) fail(`${filename}: no dimensions for ${key}`);
		}
	}
}

if (errors.length) {
	console.error(`SEO validation failed with ${errors.length} issue(s):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(
	`SEO metadata valid for ${Object.keys(STORY_METADATA).length} stories and ${Object.keys(mediaManifest).length} raster assets.`
);
