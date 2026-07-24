import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import {
	buildSeo,
	createBreadcrumbSchema,
	createPersonSchema,
	createProfilePageSchema
} from '$lib/seo';
import { getStoryMetadata, resolveMediaOverride } from '$lib/storyMetadata';
import { publicPostSlug } from '$lib/postRoutes';

const CDN_BASE = 'https://cdn.nickesselman.nl';
const toCdnPath = (src: string) => {
	if (!src) return src;
	if (/^https?:\/\//i.test(src)) return src;
	if (src.startsWith('/blogimages/')) return `${CDN_BASE}${src}`;
	return src;
};

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');
const mediaRegex = /!\[([^\]]*?)\]\(([^)]+)\)/g;
const supportedMedia = /\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov)(?:[?#].*)?$/i;

const collectPostMedia = () => {
	if (!fs.existsSync(POSTS_DIR)) return [];
	const media: { src: string; alt: string; isVideo: boolean }[] = [];
	const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith('.md'));

	for (const file of files) {
		const filePath = path.join(POSTS_DIR, file);
		const content = fs.readFileSync(filePath, 'utf-8');
		const sections = content.split('---').filter((s) => s.trim());
		const mainFMRaw = sections[0] || '';
		const mainData = matter(`---\n${mainFMRaw}\n---`).data || {};
		const slug = publicPostSlug(file.replace(/\.md$/, ''));
		const storyMetadata = getStoryMetadata(slug);
		if (mainData.coverImage) {
			const src = String(mainData.coverImage);
			media.push({
				src,
				alt: `Cover image for ${storyMetadata?.title.en || mainData.title || slug}`,
				isVideo: src.toLowerCase().endsWith('.mp4')
			});
		}
		let match: RegExpExecArray | null;
		while ((match = mediaRegex.exec(content))) {
			const authoredAlt = match[1]?.trim() || '';
			const src = match[2]?.trim();
			const override = src ? resolveMediaOverride(slug, src, 'en') : undefined;
			if (src && !override?.suppress) {
				media.push({
					src: override?.replacement || src,
					alt: override?.alt || authoredAlt || readableMediaName(src),
					isVideo: src.toLowerCase().endsWith('.mp4')
				});
			}
		}
	}

	const unique = Array.from(new Map(media.map((item) => [item.src, item])).values()).filter(
		(item) =>
			(/^https?:\/\//i.test(item.src) || item.src.startsWith('/')) &&
			supportedMedia.test(item.src)
	);
	return unique.map((item) => ({ ...item, src: toCdnPath(item.src) }));
};

const readableMediaName = (src: string) => {
	const filename = decodeURIComponent(src.split('/').pop() || '')
		.replace(/\.[^.]+$/, '')
		.replace(/[-_]+/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.trim();
	return filename ? `Scene from the journal: ${filename}` : 'Scene from a recent journal';
};

const shuffle = <T>(input: T[]): T[] => {
	const arr = [...input];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
};

export async function load() {
	const allMedia = collectPostMedia();
	const fallbackMedia = [
		'/blogimages/neighborhood/planeride.webp',
		'/blogimages/neighborhood/linkedin.webp',
		'/blogimages/neighborhood/elliottDancing.mp4',
		'/blogimages/neighborhood/uno.webp',
		'/blogimages/neighborhood/morningwalkv2.webp',
		'/blogimages/neighborhood/githubhqpanorrama1.webp',
		'/blogimages/undercity/githubroof.webp',
		'/blogimages/undercity/group.webp',
		'/blogimages/neighborhood/paolobeingsmart.mp4',
		'/blogimages/neighborhood/populated.webp'
	].map((src) => ({
		src: toCdnPath(src),
		isVideo: src.endsWith('.mp4'),
		alt: readableMediaName(src)
	}));

	const stillImages = allMedia.filter((item) => !item.isVideo);
	const mediaPool = stillImages.length > 0 ? stillImages : fallbackMedia.filter((item) => !item.isVideo);
	const carouselImages = shuffle(mediaPool).slice(0, 24);

	const aboutMeImage = '/me.webp';

	const seoDescription =
		'About Nick Esselman: builder, programmer, and photographer sharing projects, trips, and notes from the road.';

	return {
		carouselImages,
		aboutMeImage,
		locale: 'en',
		seo: buildSeo({
			title: 'About Nick',
			description: seoDescription,
			pathname: '/about',
			alternates: {
				en: 'https://blog.nickesselman.nl/about',
				nl: 'https://blog.nickesselman.nl/nl/about',
				xDefault: 'https://blog.nickesselman.nl/about'
			},
			ogType: 'profile',
			image: '/me.webp',
			imageAlt: 'Portrait of Nick Esselman',
			structuredData: [
				createProfilePageSchema({
					description: seoDescription,
					pathname: '/about',
					image: '/me.webp'
				}),
				createPersonSchema({
					description: seoDescription,
					image: '/me.webp'
				}),
				createBreadcrumbSchema([
					{ name: 'Home', pathname: '/' },
					{ name: 'About', pathname: '/about' }
				])
			]
		})
	};
}
