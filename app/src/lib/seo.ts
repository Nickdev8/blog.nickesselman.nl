export const SITE_URL = 'https://blog.nickesselman.nl';
export const SITE_NAME = 'Nick Esselman’s Blog';
export const SITE_AUTHOR = 'Nick Esselman';
export const SITE_AUTHOR_URL = 'https://nickesselman.nl';
export const SITE_AUTHOR_PROFILES = [
	'https://github.com/nickdev8/',
	'https://www.linkedin.com/in/nick-esselman/',
	'https://www.instagram.com/nick.esselman/'
];
export const SITE_DESCRIPTION =
	'Trip journals, build notes, and long-form travel stories by Nick Esselman.';
export const DEFAULT_OG_IMAGE_PATH = '/og-image.jpg';
export const DEFAULT_OG_IMAGE = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;
export const DEFAULT_ROBOTS =
	'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';

export type JsonLd = Record<string, unknown>;

export type SeoData = {
	title: string;
	description: string;
	canonical: string;
	robots: string;
	ogType: 'website' | 'article' | 'profile';
	image: string;
	imageAlt: string;
	structuredData: JsonLd[];
	alternates?: {
		en: string;
		nl: string;
		xDefault?: string;
	};
	publishedTime?: string;
	modifiedTime?: string;
};

type BuildSeoInput = {
	title?: string;
	description?: string;
	pathname?: string;
	robots?: string;
	ogType?: SeoData['ogType'];
	image?: string;
	imageAlt?: string;
	structuredData?: JsonLd[];
	alternates?: SeoData['alternates'];
	publishedTime?: string;
	modifiedTime?: string;
	appendSiteName?: boolean;
};

const createPersonReference = () => ({
	'@type': 'Person',
	'@id': `${SITE_AUTHOR_URL}/#person`,
	name: SITE_AUTHOR,
	url: SITE_AUTHOR_URL,
	sameAs: SITE_AUTHOR_PROFILES
});

export const toAbsoluteUrl = (pathname = '/') => {
	if (/^https?:\/\//i.test(pathname)) return pathname;
	const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
	return new URL(normalized, `${SITE_URL}/`).toString();
};

export const toAbsoluteImage = (value?: string) => {
	if (!value) return DEFAULT_OG_IMAGE;
	return /^https?:\/\//i.test(value) ? value : toAbsoluteUrl(value);
};

export const humanizeSlug = (value: string) =>
	value
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');

export const buildSeo = ({
	title,
	description = SITE_DESCRIPTION,
	pathname = '/',
	robots = DEFAULT_ROBOTS,
	ogType = 'website',
	image,
	imageAlt,
	structuredData = [],
	alternates,
	publishedTime,
	modifiedTime,
	appendSiteName = true
}: BuildSeoInput = {}): SeoData => ({
	title: title ? (appendSiteName ? `${title} | ${SITE_NAME}` : title) : SITE_NAME,
	description,
	canonical: toAbsoluteUrl(pathname),
	robots,
	ogType,
	image: toAbsoluteImage(image),
	imageAlt: imageAlt || title || SITE_NAME,
	structuredData,
	alternates,
	publishedTime,
	modifiedTime
});

export const defaultSeo = buildSeo();

export const serializeJsonLd = (value: JsonLd) => JSON.stringify(value).replace(/</g, '\\u003c');

export const createWebsiteSchema = ({
	language = 'en'
}: {
	language?: 'en' | 'nl';
} = {}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'WebSite',
	'@id': `${SITE_URL}/#website`,
	name: SITE_NAME,
	alternateName: 'blog.nickesselman.nl',
	url: `${SITE_URL}/`,
	description: SITE_DESCRIPTION,
	inLanguage: language,
	publisher: createPersonReference()
});

export const createCollectionPageSchema = ({
	name,
	description,
	pathname,
	image,
	language = 'en'
}: {
	name: string;
	description: string;
	pathname: string;
	image?: string;
	language?: 'en' | 'nl';
}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'CollectionPage',
	name,
	description,
	url: toAbsoluteUrl(pathname),
	inLanguage: language,
	primaryImageOfPage: toAbsoluteImage(image),
	isPartOf: {
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		name: SITE_NAME,
		url: `${SITE_URL}/`
	}
});

export const createItemListSchema = (
	items: { name: string; pathname: string; description?: string }[]
): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'ItemList',
	itemListElement: items.map((item, index) => ({
		'@type': 'ListItem',
		position: index + 1,
		url: toAbsoluteUrl(item.pathname),
		name: item.name,
		description: item.description
	}))
});

export const createAboutPageSchema = ({
	description,
	pathname,
	image,
	language = 'en',
	name = `About ${SITE_AUTHOR}`
}: {
	description: string;
	pathname: string;
	image?: string;
	language?: 'en' | 'nl';
	name?: string;
}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'AboutPage',
	name,
	description,
	url: toAbsoluteUrl(pathname),
	inLanguage: language,
	about: createPersonReference(),
	primaryImageOfPage: toAbsoluteImage(image)
});

export const createProfilePageSchema = ({
	description,
	pathname,
	image,
	language = 'en',
	name = `${SITE_AUTHOR} profile`
}: {
	description: string;
	pathname: string;
	image?: string;
	language?: 'en' | 'nl';
	name?: string;
}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'ProfilePage',
	'@id': `${toAbsoluteUrl(pathname)}#profile`,
	name,
	description,
	url: toAbsoluteUrl(pathname),
	inLanguage: language,
	mainEntity: {
		...createPersonReference(),
		description,
		image: toAbsoluteImage(image)
	},
	isPartOf: {
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		name: SITE_NAME,
		url: SITE_URL
	}
});

export const createPersonSchema = ({
	description,
	image
}: {
	description: string;
	image?: string;
}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'Person',
	'@id': `${SITE_AUTHOR_URL}/#person`,
	name: SITE_AUTHOR,
	url: SITE_AUTHOR_URL,
	description,
	image: toAbsoluteImage(image),
	sameAs: SITE_AUTHOR_PROFILES
});

export const createArticleSchema = ({
	headline,
	description,
	pathname,
	image,
	datePublished,
	dateModified,
	language = 'en'
}: {
	headline: string;
	description: string;
	pathname: string;
	image?: string;
	datePublished?: string;
	dateModified?: string;
	language?: 'en' | 'nl';
}): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'BlogPosting',
	'@id': `${toAbsoluteUrl(pathname)}#article`,
	headline,
	description,
	url: toAbsoluteUrl(pathname),
	mainEntityOfPage: {
		'@type': 'WebPage',
		'@id': toAbsoluteUrl(pathname)
	},
	image: [toAbsoluteImage(image)],
	inLanguage: language,
	author: createPersonReference(),
	publisher: createPersonReference(),
	datePublished,
	dateModified: dateModified || datePublished,
	isPartOf: {
		'@type': 'Blog',
		name: SITE_NAME,
		url: SITE_URL
	}
});

export const createBreadcrumbSchema = (
	items: { name: string; pathname: string }[]
): JsonLd => ({
	'@context': 'https://schema.org',
	'@type': 'BreadcrumbList',
	itemListElement: items.map((item, index) => ({
		'@type': 'ListItem',
		position: index + 1,
		name: item.name,
		item: toAbsoluteUrl(item.pathname)
	}))
});
