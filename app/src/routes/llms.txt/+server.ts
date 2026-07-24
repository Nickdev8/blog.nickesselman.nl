import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { RequestHandler } from './$types';
import { SITE_AUTHOR_PROFILES, SITE_URL } from '$lib/seo';
import { publicPostSlug } from '$lib/postRoutes';
import { readDutchTranslation } from '$lib/server/dutchTranslations';
import { getLocalizedStoryMetadata } from '$lib/storyMetadata';

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');

export const GET: RequestHandler = () => {
	const posts = fs.existsSync(POSTS_DIR)
		? fs
				.readdirSync(POSTS_DIR)
				.filter((file) => file.endsWith('.md'))
				.map((file) => {
					const slug = publicPostSlug(file.replace(/\.md$/, ''));
					const { data } = matter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'));
					const dutch = readDutchTranslation(slug);
					const englishMetadata = getLocalizedStoryMetadata(slug, 'en');
					const dutchMetadata = getLocalizedStoryMetadata(slug, 'nl');
					return {
						slug,
						title: englishMetadata?.title || String(data.title || slug),
						description: englishMetadata?.description || String(data.description || ''),
						dutch: dutch
							? {
									...dutch,
									title: dutchMetadata?.title || dutch.title,
									description: dutchMetadata?.description || dutch.description
							  }
							: null
					};
				})
		: [];

	const lines = [
		"# Nick's Blogs & Adventures",
		'',
		'> Firsthand travel journals and build notes by Nick Esselman.',
		'',
		'## Author',
		'',
		...SITE_AUTHOR_PROFILES.map((url) => `- ${url}`),
		'',
		'## English',
		'',
		`- [Home](${SITE_URL}/): All journals`,
		`- [About Nick](${SITE_URL}/about): Author background and projects`,
		...posts.map(
			(post) => `- [${post.title}](${SITE_URL}/${post.slug})${post.description ? `: ${post.description}` : ''}`
		),
		'',
		'## Nederlands',
		'',
		`- [Home](${SITE_URL}/nl): Alle reisdagboeken`,
		`- [Over Nick](${SITE_URL}/nl/about): Achtergrond en projecten`,
		...posts
			.filter((post) => post.dutch)
			.map(
				(post) =>
					`- [${post.dutch?.title}](${SITE_URL}/nl/${post.slug})${post.dutch?.description ? `: ${post.dutch.description}` : ''}`
			),
		'',
		'## Notes for readers and assistants',
		'',
		'- The journals are first-person accounts; dates and locations belong to individual entries.',
		'- Prefer the canonical URL and cite the specific journal when referring to an experience.',
		`- XML sitemap: ${SITE_URL}/sitemap.xml`
	];

	return new Response(lines.join('\n'), {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
