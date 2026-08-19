import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { mutateReaderDB } from '$lib/server/readerStore';

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const NTFY_NOTES_URL = 'https://ntfy.sh/blognickesselmannotes';

export const getTurnstileSiteKey = () =>
	dev ? TURNSTILE_TEST_SITE_KEY : publicEnv.PUBLIC_TURNSTILE_SITE_KEY || '';

const verifyTurnstile = async (fetcher: typeof globalThis.fetch, token: string, remoteIp?: string) => {
	const secret = dev ? TURNSTILE_TEST_SECRET_KEY : privateEnv.TURNSTILE_SECRET_KEY || '';
	const siteKey = getTurnstileSiteKey();
	if (dev || !secret || !siteKey) return true;
	if (!token) return false;

	const body = new URLSearchParams({ secret, response: token });
	if (remoteIp) body.set('remoteip', remoteIp);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetcher(TURNSTILE_VERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
			signal: controller.signal
		});
		if (!response.ok) return false;
		const result = (await response.json()) as { success?: boolean };
		return result.success === true;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
};

export type PrivateNoteInput = {
	name: string;
	message: string;
	anonId: string;
	event: string;
	path: string;
	storyTitle: string;
	turnstileToken: string;
	remoteIp?: string;
};

const notifyAboutPrivateNote = async (input: PrivateNoteInput, fetcher: typeof globalThis.fetch) => {
	const response = await fetcher(NTFY_NOTES_URL, {
		method: 'POST',
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'Title': 'New private blog note',
			'Tags': 'memo',
			'Click': `https://blog.nickesselman.nl${input.path}`
		},
		// ntfy.sh public topics are readable by anyone who knows the topic name.
		// Keep the visitor's name and private message in the local reader store only.
		body: `A new private note was left on ${input.storyTitle.replace(/[\r\n]+/g, ' ')}.`
	});
	return response.ok;
};

export const savePrivateNote = async (input: PrivateNoteInput, fetcher: typeof globalThis.fetch) => {
	const verified = await verifyTurnstile(fetcher, input.turnstileToken, input.remoteIp);
	if (!verified) return { ok: false as const, status: 400, error: 'Please complete the spam check and try again.' };

	const id = crypto.randomUUID();
	const createdAt = Date.now();
	await mutateReaderDB((db) => {
		db.rows.push({ kind: 'note', id, anon_id: input.anonId, event: input.event, path: input.path, name: input.name, message: input.message, notification_status: 'pending', created_at: createdAt });
	});

	let notificationStatus: 'sent' | 'failed' = 'failed';
	try {
		notificationStatus = (await notifyAboutPrivateNote(input, fetcher)) ? 'sent' : 'failed';
	} catch {
		console.error('Private blog note ntfy delivery failed', { noteId: id, event: input.event });
	}

	await mutateReaderDB((db) => {
		const row = db.rows.find((entry) => entry.kind === 'note' && entry.id === id);
		if (row?.kind === 'note') row.notification_status = notificationStatus;
	});

	return { ok: true as const, notificationStatus };
};
