import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { load as loadEnglish, actions as englishActions } from '../../[event]/+page.server';
import { applyDutchTranslation, readDutchTranslation } from '$lib/server/dutchTranslations';
import { legacyPostRedirect } from '$lib/postRoutes';
import {
	createArticleSchema,
	createBreadcrumbSchema,
	toAbsoluteUrl
} from '$lib/seo';
import { getLocalizedStoryMetadata, STORY_METADATA } from '$lib/storyMetadata';

export const load: PageServerLoad = async (event) => {
	const legacyRedirect = legacyPostRedirect(event.params.event);
	if (legacyRedirect) throw redirect(308, `/nl${legacyRedirect}`);

	const base = await loadEnglish(event as never);
	if (!base) throw error(500, 'Het verhaal kon niet worden geladen.');
	const translation = readDutchTranslation(event.params.event);
	if (!translation) {
		return {
			...base,
			locale: 'nl' as const,
			translationPending: true,
			seo: {
				...base.seo,
				canonical: toAbsoluteUrl(`/${event.params.event}`),
				robots: 'noindex,follow',
				alternates: undefined,
				structuredData: []
			}
		};
	}

	const translated = applyDutchTranslation(base as never, translation) as typeof base;
	const pathname = `/nl/${event.params.event}`;
	const storyMetadata = getLocalizedStoryMetadata(event.params.event, 'nl');
	return {
		...translated,
		relatedStories: (storyMetadata?.related || [])
			.map((slug) => STORY_METADATA[slug])
			.filter(Boolean)
			.map((story) => ({ slug: story.slug, title: story.title.nl })),
		locale: 'nl' as const,
		translationPending: false,
		seo: {
			...translated.seo,
			title: storyMetadata?.title || translation.title,
			description: storyMetadata?.description || translation.description,
			canonical: toAbsoluteUrl(pathname),
			structuredData: [
				createArticleSchema({
					headline: storyMetadata?.title || translation.title,
					description: storyMetadata?.description || translation.description,
					pathname,
					image: translated.seo.image,
					datePublished: translated.seo.publishedTime,
					dateModified: translated.seo.modifiedTime,
					language: 'nl'
				}),
				createBreadcrumbSchema([
					{ name: 'Home', pathname: '/nl' },
					{ name: translation.title, pathname }
				])
			]
		}
	};
};

export const actions = englishActions as unknown as Actions;
