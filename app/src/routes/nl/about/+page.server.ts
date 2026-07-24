import type { PageServerLoad } from './$types';
import { load as loadEnglish } from '../../about/+page.server';
import {
	SITE_NAME,
	createBreadcrumbSchema,
	createPersonSchema,
	createProfilePageSchema,
	toAbsoluteUrl
} from '$lib/seo';

export const load: PageServerLoad = async (event) => {
	const base = await loadEnglish();
	const description =
		'Over Nick Esselman, een jonge bouwer, programmeur en fotograaf die projecten, reizen en Hack Club-evenementen documenteert.';
	return {
		...base,
		locale: 'nl' as const,
		seo: {
			...base.seo,
			title: `Over Nick | ${SITE_NAME}`,
			description,
			canonical: toAbsoluteUrl('/nl/about'),
			structuredData: [
				createProfilePageSchema({
					name: 'Over Nick Esselman',
					description,
					pathname: '/nl/about',
					image: '/me.webp',
					language: 'nl'
				}),
				createPersonSchema({ description, image: '/me.webp' }),
				createBreadcrumbSchema([
					{ name: 'Home', pathname: '/nl' },
					{ name: 'Over Nick', pathname: '/nl/about' }
				])
			]
		}
	};
};
