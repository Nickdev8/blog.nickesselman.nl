import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, EntryGenerator, Actions } from './$types';
import { env } from '$env/dynamic/private';
import {
	buildSeo,
	createArticleSchema,
	createBreadcrumbSchema,
	humanizeSlug
} from '$lib/seo';
import { getTurnstileSiteKey, savePrivateNote } from '$lib/server/privateNote';
import { legacyPostRedirect, publicPostSlug, sourcePostSlug } from '$lib/postRoutes';
import { readDutchTranslation } from '$lib/server/dutchTranslations';
import {
	getLocalizedStoryMetadata,
	resolveMediaOverride,
	STORY_METADATA
} from '$lib/storyMetadata';
import { sanitizeJournalHtml } from '$lib/server/journalHtml';

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
		event: publicPostSlug(file.replace(/\.md$/, ''))
	}));
};

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { event } = params;
	const legacyRedirect = legacyPostRedirect(event);
	if (legacyRedirect) throw redirect(308, legacyRedirect);
	const sourceEventName = sourcePostSlug(event);
	const filePath = path.join('src/posts', `${sourceEventName}.md`);

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

	type MediaBlock = {
		type: 'media';
		media: { src: string; alt: string; caption: string; layout: string[] };
	};
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

			const rawSrc = src.trim();
			const override = resolveMediaOverride(eventName, rawSrc, 'en');
			const authoredAlt = altRaw.trim();
			const hasUsefulAuthoredAlt =
				Boolean(authoredAlt) && !/^(?:alt text|image|photo|extra image)$/i.test(authoredAlt);
			const layoutArr = layoutRaw ? layoutRaw.trim().split(/\s+/).filter(Boolean) : [];
			blocks.push({
				type: 'media',
				media: {
					src: override?.suppress ? '' : toCdnPath(override?.replacement || rawSrc) || '',
					alt: override?.alt || authoredAlt,
					caption: hasUsefulAuthoredAlt ? authoredAlt : '',
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

	const extraImagesDir = path.join('static', 'blogimages', sourceEventName, 'extra');
	const leftoverImages = fs.existsSync(extraImagesDir)
		? fs.readdirSync(extraImagesDir).map((file) => ({
						src: toCdnPath(`/blogimages/${sourceEventName}/extra/${file}`) || '',
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
	const storyMetadata = getLocalizedStoryMetadata(eventName, 'en');
	const seoTitle =
		storyMetadata?.title ||
		(titleBase.toLowerCase().includes(eventLabel.toLowerCase())
			? titleBase
			: `${eventLabel}: ${titleBase}`);
	const entryCountLabel = posts.length === 1 ? 'entry' : 'entries';
	const seoDescription =
		storyMetadata?.description ||
		mainData.description ||
		`${eventLabel} travel journal with ${posts.length || 'multiple'} ${entryCountLabel} by Nick Esselman.`;

	const envKeyBase = sourceEventName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
	const scopedImmichEnvKey = `${envKeyBase}_IMMICH_ALBUM_URL`;
	const envAlbum = env[scopedImmichEnvKey] || env.IMMICH_DEFAULT_ALBUM_URL;
	const immichAlbum = mainData.immichAlbum || envAlbum || '';
	const scopedGalleryManifestKey = `${envKeyBase}_GALLERY_MANIFEST_URL`;
	const galleryManifestUrl =
		mainData.galleryManifest ||
		env[scopedGalleryManifestKey] ||
		env.GALLERY_DEFAULT_MANIFEST_URL ||
		'';
	const galleryAssets = await loadPublishedGallery(galleryManifestUrl, fetch);

	return {
		posts,
		event,
		locale: 'en',
		leftoverImages,
		banner,
		title: mainData.title || '',
		description: mainData.description || '',
		coverImage: toCdnPath(mainData.coverImage) || '',
		coverImageAlt: `Cover image for ${seoTitle}`,
		content: '',
		images: [],
		tripDateRange: { start: startDate, end: endDate },
		relatedStories: (storyMetadata?.related || [])
			.map((slug) => STORY_METADATA[slug])
			.filter(Boolean)
			.map((story) => ({ slug: story.slug, title: story.title.en })),
		immichAlbum,
		galleryAssets,
		sortOrder,
		timezone: mainData.timezone || '',
		timezoneLabel: mainData.timezone_label || '',
		seo: buildSeo({
			title: seoTitle,
			description: seoDescription,
			pathname: `/${eventName}`,
			alternates: {
				en: `https://blog.nickesselman.nl/${eventName}`,
				nl: `https://blog.nickesselman.nl/nl/${eventName}`,
				xDefault: `https://blog.nickesselman.nl/${eventName}`
			},
			ogType: 'article',
			image: toCdnPath(mainData.coverImage),
			imageAlt: `Cover image for ${seoTitle}`,
			publishedTime: storyMetadata?.publishedTime,
			modifiedTime: storyMetadata?.modifiedTime,
			structuredData: [
				createArticleSchema({
					headline: seoTitle,
					description: seoDescription,
					pathname: `/${eventName}`,
					image: toCdnPath(mainData.coverImage),
					datePublished: storyMetadata?.publishedTime,
					dateModified: storyMetadata?.modifiedTime
				}),
				createBreadcrumbSchema([
					{ name: 'Home', pathname: '/' },
					{ name: titleBase, pathname: `/${eventName}` }
				])
			]
		}),
		turnstileSiteKey: getTurnstileSiteKey()
	};
};

export const actions: Actions = {
	note: async ({ request, params, fetch, getClientAddress, url }) => {
		const event = params.event;
		if (!/^[a-zA-Z0-9_-]+$/.test(event)) return fail(400, { noteError: 'Invalid story.' });
		const legacyRedirect = legacyPostRedirect(event);
		if (legacyRedirect) throw redirect(308, legacyRedirect);
		const filePath = path.join('src/posts', `${sourcePostSlug(event)}.md`);
		if (!fs.existsSync(filePath)) return fail(404, { noteError: 'Story not found.' });

		const form = await request.formData();
		if ((form.get('website')?.toString() || '').trim()) return { noteSuccess: true };

		const name = (form.get('name')?.toString() || '').trim();
		const message = (form.get('message')?.toString() || '').trim();
		const submittedAnonId = (form.get('readerId')?.toString() || '').trim();
		const anonId = submittedAnonId || crypto.randomUUID();
		const turnstileToken = (form.get('cf-turnstile-response')?.toString() || '').trim();
		const invalid = { noteName: name, noteMessage: message };

		if (!name || name.length > 80) return fail(400, { ...invalid, noteError: 'Please enter a name of 80 characters or fewer.' });
		if (!message || message.length > 2000) return fail(400, { ...invalid, noteError: 'Please write a note of 2,000 characters or fewer.' });
		if (anonId.length > 120) return fail(400, { ...invalid, noteError: 'Please refresh the page and try again.' });

		const { data: frontmatter } = matter(fs.readFileSync(filePath, 'utf-8'));
		const dutchTranslation = url.pathname.startsWith('/nl/') ? readDutchTranslation(event) : null;
		let remoteIp: string | undefined;
		try { remoteIp = getClientAddress(); } catch { remoteIp = undefined; }

		const result = await savePrivateNote({
			name,
			message,
			anonId,
			event,
			path: url.pathname,
			storyTitle: dutchTranslation?.title || frontmatter.title || event,
			turnstileToken,
			remoteIp
		}, fetch);

		if (!result.ok) return fail(result.status, { ...invalid, noteError: result.error });
		return { noteSuccess: true };
	}
};
const renderMarkdown = (input: string) => {
	const nestedHeadings = input.replace(/^##(\s+)/gm, '###$1');
	const parsed = marked.parse(nestedHeadings);
	if (typeof parsed === 'string') {
		return sanitizeJournalHtml(parsed);
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

type PublishedGalleryAsset = {
	id: string;
	previewUrl: string;
	originalUrl: string;
	alt: string;
	isVideo: boolean;
	width?: number | null;
	height?: number | null;
	srcset?: string | null;
};

const publishedGalleryCache = new Map<
	string,
	{ assets: PublishedGalleryAsset[]; expiresAt: number }
>();

const loadPublishedGallery = async (
	manifestUrl: string,
	requestFetch: typeof fetch
): Promise<PublishedGalleryAsset[]> => {
	if (!manifestUrl) return [];
	const cached = publishedGalleryCache.get(manifestUrl);
	if (cached && cached.expiresAt > Date.now()) return cached.assets;
	try {
		const parsed = new URL(manifestUrl);
		if (parsed.protocol !== 'https:' || parsed.hostname !== 'cdn.nickesselman.nl') return [];
		const response = await requestFetch(parsed, { signal: AbortSignal.timeout(5_000) });
		if (!response.ok) return cached?.assets || [];
		const manifest = (await response.json()) as { assets?: PublishedGalleryAsset[] };
		const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
		publishedGalleryCache.set(manifestUrl, {
			assets,
			expiresAt: Date.now() + 5 * 60 * 1000
		});
		return assets;
	} catch {
		return cached?.assets || [];
	}
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
