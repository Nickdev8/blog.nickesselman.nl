import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { PageServerLoad } from './$types';
import {
	DEFAULT_OG_IMAGE_PATH,
	buildSeo,
	createCollectionPageSchema,
	createItemListSchema,
	createWebsiteSchema
} from '$lib/seo';
import { publicPostSlug } from '$lib/postRoutes';
import { getLocalizedStoryMetadata } from '$lib/storyMetadata';

const CDN_BASE = 'https://cdn.nickesselman.nl';
const toCdnPath = (src?: string) => {
	if (!src) return src;
	if (/^https?:\/\//i.test(src)) return src;
	if (src.startsWith('/blogimages/')) return `${CDN_BASE}${src}`;
	return src;
};

export const load: PageServerLoad = async () => {
	const postsDir = 'src/posts';
	const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md'));

	const events = files.map((filename) => {
		const filePath = path.join(postsDir, filename);
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const { data } = matter(fileContent);

		const sections = fileContent.split('---').filter((s) => s.trim());
		const dateStamps: number[] = [];
		for (let i = 1; i < sections.length; i += 2) {
			const fm = sections[i];
			const fmData = matter(`---\n${fm}\n---`).data || {};
			const time = fmData.date ? new Date(fmData.date).getTime() : NaN;
			if (!Number.isNaN(time)) {
				dateStamps.push(time);
			}
		}
		const latestDate = dateStamps.length ? Math.max(...dateStamps) : 0;

		const slug = publicPostSlug(filename.replace(/\.md$/, ''));
		const storyMetadata = getLocalizedStoryMetadata(slug, 'en');

		return {
			slug,
			title: data.title || slug,
			description: data.description || 'No description available.',
			seoTitle: storyMetadata?.title || data.title || slug,
			seoDescription:
				storyMetadata?.description || data.description || 'No description available.',
			coverImage: toCdnPath(data.coverImage) || DEFAULT_OG_IMAGE_PATH,
			live: data.live || false,
			latestDate
		};
	});

	events.sort((a, b) => (b.latestDate || 0) - (a.latestDate || 0));
	const liveEvent = events.find((event) => event.live);
	const seoDescription =
		'Read Nick Esselman’s firsthand travel journals and build notes from Hack Club events, creative projects, and adventures around the world.';
	const seoImage = liveEvent?.coverImage || events[0]?.coverImage || DEFAULT_OG_IMAGE_PATH;

	return {
		events,
		locale: 'en',
		seo: buildSeo({
			title: 'Travel Journals & Build Notes',
			description: seoDescription,
			pathname: '/',
			alternates: {
				en: 'https://blog.nickesselman.nl/',
				nl: 'https://blog.nickesselman.nl/nl',
				xDefault: 'https://blog.nickesselman.nl/'
			},
			image: seoImage,
			imageAlt: liveEvent
				? `Cover image for ${liveEvent.title}`
				: 'Cover image for Nick Esselman’s Blog',
			structuredData: [
				createWebsiteSchema(),
				createCollectionPageSchema({
					name: 'Stories from the road',
					description: seoDescription,
					pathname: '/',
					image: seoImage
				}),
				createItemListSchema(
					events.slice(0, 12).map((event) => ({
						name: event.seoTitle,
						pathname: `/${event.slug}`,
						description: event.seoDescription
					}))
				)
			]
		})
	};
};
