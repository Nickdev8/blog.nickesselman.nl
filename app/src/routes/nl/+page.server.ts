import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { load as loadEnglish } from '../+page.server';
import { readDutchTranslation } from '$lib/server/dutchTranslations';
import {
	SITE_NAME,
	createCollectionPageSchema,
	createItemListSchema,
	createWebsiteSchema,
	toAbsoluteUrl
} from '$lib/seo';
import { getLocalizedStoryMetadata } from '$lib/storyMetadata';

export const load: PageServerLoad = async (event) => {
	const base = await loadEnglish(event as never);
	if (!base) throw error(500, 'De verhalen konden niet worden geladen.');
	type HomePost = { slug: string; title: string; description: string; coverImage: string; live: boolean; latestDate: number };
	let translationPending = false;
	const events = (base.events as HomePost[]).map((post) => {
		const translation = readDutchTranslation(post.slug);
		if (!translation) {
			translationPending = true;
			return post;
		}
		return { ...post, title: translation.title, description: translation.description };
	});

	const seoDescription =
		'Lees de reisdagboeken en bouwverslagen van Nick Esselman over Hack Club-evenementen, creatieve projecten en avonturen over de hele wereld.';
	return {
		...base,
		events,
		locale: 'nl' as const,
		translationPending,
		seo: {
			...base.seo,
			title: SITE_NAME,
			description: seoDescription,
			canonical: toAbsoluteUrl('/nl'),
			structuredData: [
				createWebsiteSchema({ language: 'nl' }),
				createCollectionPageSchema({
					name: 'Verhalen van onderweg',
					description: seoDescription,
					pathname: '/nl',
					image: base.seo.image,
					language: 'nl'
				}),
				createItemListSchema(
					events.slice(0, 12).map((post) => ({
						name: getLocalizedStoryMetadata(post.slug, 'nl')?.title || post.title,
						pathname: `/nl/${post.slug}`,
						description:
							getLocalizedStoryMetadata(post.slug, 'nl')?.description || post.description
					}))
				)
			]
		}
	};
};
