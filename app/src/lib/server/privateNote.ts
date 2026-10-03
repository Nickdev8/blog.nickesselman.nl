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

type NoteNotification = Pick<PrivateNoteInput, 'name' | 'message' | 'path' | 'storyTitle'>;

export const notifyAboutPrivateNote = async (input: NoteNotification, fetcher: typeof globalThis.fetch) => {
	const sender = input.name.replace(/[\r\n]+/g, ' ').trim();
	const storyTitle = input.storyTitle.replace(/[\r\n]+/g, ' ').trim();
	let error = 'Unknown delivery error';
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const response = await fetcher(NTFY_NOTES_URL, {
				method: 'POST',
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					'Title': 'New blog note',
					'Tags': 'memo',
					'Click': `https://blog.nickesselman.nl${input.path}`
				},
				body: [`Story: ${storyTitle}`, `From: ${sender}`, '', input.message].join('\n'),
				signal: AbortSignal.timeout(8000)
			});
			if (response.ok) return { status: 'sent' as const };
			error = `ntfy returned HTTP ${response.status}`;
			if (response.status !== 429 && response.status < 500) break;
		} catch (cause) {
			const networkCause = cause instanceof Error && 'cause' in cause ? cause.cause : undefined;
			const code = networkCause && typeof networkCause === 'object' && 'code' in networkCause
				? String(networkCause.code)
				: undefined;
			error = cause instanceof Error
				? `${cause.name}: ${cause.message}${code ? ` (${code})` : ''}`
				: 'Network request failed';
		}
		if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
	}
	return { status: 'failed' as const, error: error.slice(0, 200) };
};

export const savePrivateNote = async (input: PrivateNoteInput, fetcher: typeof globalThis.fetch) => {
	const verified = await verifyTurnstile(fetcher, input.turnstileToken, input.remoteIp);
	if (!verified) return { ok: false as const, status: 400, error: 'Please complete the spam check and try again.' };

	const id = crypto.randomUUID();
	const createdAt = Date.now();
	await mutateReaderDB((db) => {
		db.rows.push({ kind: 'note', id, anon_id: input.anonId, event: input.event, path: input.path, name: input.name, message: input.message, notification_status: 'pending', created_at: createdAt });
	});

	const delivery = await notifyAboutPrivateNote(input, fetcher);
	if (delivery.status === 'failed')
		console.error('Blog note ntfy delivery failed', { noteId: id, event: input.event, error: delivery.error });

	await mutateReaderDB((db) => {
		const row = db.rows.find((entry) => entry.kind === 'note' && entry.id === id);
		if (row?.kind === 'note') {
			row.notification_status = delivery.status;
			row.notification_error = delivery.error;
		}
	});

	return { ok: true as const, notificationStatus: delivery.status };
};
