import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { error } from '@sveltejs/kit';
import type { PageServerLoad, EntryGenerator } from './$types';
import { env } from '$env/dynamic/private';
import {
	buildSeo,
	createArticleSchema,
	createBreadcrumbSchema,
	humanizeSlug
} from '$lib/seo';

const CDN_BASE = 'https://cdn.nickesselman.nl';
const toCdnPath = (src?: string) => {
	if (!src) return src;
	if (/^https?:\/\//i.test(src)) return src;
	if (src.startsWith('/blogimages/')) return `${CDN_BASE}${src}`;
	return src;
};

export const entries: EntryGenerator = () => {
	const postsDir = 'src/posts';
	const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md'));

	return files.map((file) => ({
		event: file.replace(/\.md$/, '')
	}));
};

export const load: PageServerLoad = async ({ params }) => {
	const { event } = params;
	const filePath = path.join('src/posts', `${event}.md`);

	if (!fs.existsSync(filePath)) {
		throw error(404, 'Not found');
	}

	const fileContent = fs.readFileSync(filePath, 'utf-8');
	const eventName = event;
	const sections = fileContent.split('---').filter((s) => s.trim());

	const mainFMRaw = sections[0] || '';
	const mainData = matter(`---\n${mainFMRaw}\n---`).data || {};
	const banner = mainData.warning
		? {
				message: mainData.warning,
				type: mainData.warning_type || 'warning',
				dismissible: mainData.warning_dismissible !== false
		  }
		: null;

	type MediaBlock = { type: 'media'; media: { src: string; alt: string; layout: string[] } };
	type TextBlock = { type: 'text'; html: string };
	type PostBlock = MediaBlock | TextBlock;

	type EventPost = {
		title: string;
		date: string;
		slug: string;
		blocks: PostBlock[];
		event: string;
	};

	const posts: EventPost[] = [];
	for (let i = 1; i < sections.length; i += 2) {
		const frontmatter = sections[i];
		let content = sections[i + 1] || '';
		content = await replaceImmichShareLinks(content);
		const fullPostString = `---\n${frontmatter}\n---\n${content}`;
		const { data, content: parsedContent } = matter(fullPostString);

		const blocks: PostBlock[] = [];
		const mediaRegex = /!\[(.*?)\]\((.*?)\)(?:\{(.*?)\})?/gs;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = mediaRegex.exec(parsedContent))) {
			const [fullMatch, altRaw = '', src = '', layoutRaw = ''] = match;
			const preceding = parsedContent.slice(lastIndex, match.index);
			if (preceding.trim()) {
				blocks.push({ type: 'text', html: renderMarkdown(preceding) });
			}

			const layoutArr = layoutRaw ? layoutRaw.trim().split(/\s+/).filter(Boolean) : [];
			blocks.push({
				type: 'media',
				media: {
					src: toCdnPath(src.trim()) || '',
					alt: altRaw.trim(),
					layout: layoutArr
				}
			});

			lastIndex = match.index + fullMatch.length;
		}

		const remaining = parsedContent.slice(lastIndex);
		if (remaining.trim()) {
			blocks.push({ type: 'text', html: renderMarkdown(remaining) });
		}

		if (data.date && data.title) {
			const entryNumber = posts.length + 1;
			const safeSlug = `${eventName}-day-${entryNumber}`.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

			posts.push({
				title: data.title,
				date: data.date,
				slug: safeSlug,
				blocks,
				event: eventName
			});
		}
	}

	const sortOrder = mainData.sort_order || 'asc';

	if (sortOrder === 'desc') {
		posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	} else {
		posts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}

	const extraImagesDir = path.join('static', 'blogimages', eventName, 'extra');
	const leftoverImages = fs.existsSync(extraImagesDir)
		? fs.readdirSync(extraImagesDir).map((file) => ({
						src: toCdnPath(`/blogimages/${eventName}/extra/${file}`) || '',
						alt: 'Extra image'
		  }))
		: [];

	const chronologicalPosts = [...posts].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	const startDate = chronologicalPosts[0]?.date;
	const endDate = chronologicalPosts[chronologicalPosts.length - 1]?.date;
	const eventLabel = humanizeSlug(eventName);
	const titleBase = mainData.title || eventLabel;
	const seoTitle = titleBase.toLowerCase().includes(eventLabel.toLowerCase())
		? titleBase
		: `${eventLabel}: ${titleBase}`;
	const entryCountLabel = posts.length === 1 ? 'entry' : 'entries';
	const seoDescription =
		mainData.description ||
		`${eventLabel} travel journal with ${posts.length || 'multiple'} ${entryCountLabel} by Nick Esselman.`;

	const envKeyBase = eventName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
	const scopedImmichEnvKey = `${envKeyBase}_IMMICH_ALBUM_URL`;
	const envAlbum = env[scopedImmichEnvKey] || env.IMMICH_DEFAULT_ALBUM_URL;
	const immichAlbum = mainData.immichAlbum || envAlbum || '';

	return {
		posts,
		event,
		leftoverImages,
		banner,
		title: mainData.title || '',
		description: mainData.description || '',
		coverImage: toCdnPath(mainData.coverImage) || '',
		content: '',
		images: [],
		tripDateRange: { start: startDate, end: endDate },
		immichAlbum,
		sortOrder,
		timezone: mainData.timezone || '',
		timezoneLabel: mainData.timezone_label || '',
		seo: buildSeo({
			title: seoTitle,
			description: seoDescription,
			pathname: `/${eventName}`,
			ogType: 'article',
			image: toCdnPath(mainData.coverImage),
			imageAlt: `Cover image for ${seoTitle}`,
			publishedTime: startDate ? new Date(startDate).toISOString() : undefined,
			modifiedTime: endDate ? new Date(endDate).toISOString() : undefined,
			structuredData: [
				createArticleSchema({
					headline: seoTitle,
					description: seoDescription,
					pathname: `/${eventName}`,
					image: toCdnPath(mainData.coverImage),
					datePublished: startDate ? new Date(startDate).toISOString() : undefined,
					dateModified: endDate ? new Date(endDate).toISOString() : undefined
				}),
				createBreadcrumbSchema([
					{ name: 'Home', pathname: '/' },
					{ name: titleBase, pathname: `/${eventName}` }
				])
			]
		})
	};
};
const renderMarkdown = (input: string) => {
	const parsed = marked.parse(input);
	if (typeof parsed === 'string') {
		return parsed;
	}
	throw new Error('Async markdown rendering is not supported for trip posts.');
};

const replaceImmichShareLinks = async (input: string): Promise<string> => {
	const regex = /https?:\/\/photos\.nickesselman\.nl\/share\/([A-Za-z0-9_-]+)/gi;
	const unique = Array.from(new Set(input.match(regex) || []));

	let output = input;
	for (const share of unique) {
		const direct = await resolveImmichShare(share);
		if (direct) {
			output = output.split(share).join(`![Immich photo](${direct})`);
		}
	}

	return output;
};

const resolveImmichShare = async (shareLink: string): Promise<string | null> => {
	try {
		const url = new URL(shareLink);
		const key = url.pathname.split('/').filter(Boolean).pop();
		if (!key) return null;

		return `/api/immich/share/${key}`;
	} catch (err) {
		console.error('Failed to resolve Immich share link', err);
		return null;
	}
};
