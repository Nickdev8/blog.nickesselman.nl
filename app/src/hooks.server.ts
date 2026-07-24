import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { COOKIE_NAME, computeSignature } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const adminPassword = env.ADMIN_PASSWORD || '';
	const expectedSignature = adminPassword ? computeSignature(adminPassword) : null;
	const cookieSignature = event.cookies.get(COOKIE_NAME);

	event.locals.isAdmin = Boolean(expectedSignature && cookieSignature === expectedSignature);

	const language = event.url.pathname === '/nl' || event.url.pathname.startsWith('/nl/') ? 'nl' : 'en';
	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-type',
		transformPageChunk: ({ html }) => html.replace('<html lang="en"', `<html lang="${language}"`)
	});
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set(
		'content-security-policy-report-only',
		"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: https://cdn.nickesselman.nl; media-src 'self' https://cdn.nickesselman.nl; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; form-action 'self'"
	);
	if (event.url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	}
	return response;
};
