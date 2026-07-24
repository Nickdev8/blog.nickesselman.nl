export const publicPostSlug = (sourceSlug: string) =>
	sourceSlug === 'moonshot' ? 'florida' : sourceSlug;

export const sourcePostSlug = (publicSlug: string) =>
	publicSlug === 'florida' ? 'moonshot' : publicSlug;

export const legacyPostRedirect = (slug: string) =>
	slug === 'moonshot' ? '/florida' : null;
