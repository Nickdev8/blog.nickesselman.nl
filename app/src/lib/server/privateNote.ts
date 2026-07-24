import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import nodemailer from 'nodemailer';
import { mutateReaderDB } from '$lib/server/readerStore';

const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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

const createTransporter = () => {
	if (!privateEnv.SMTP_HOST || !privateEnv.SMTP_PORT || !privateEnv.SMTP_USER || !privateEnv.SMTP_PASSWORD || !privateEnv.EMAIL_FROM || !privateEnv.EMAIL_TO) return null;
	return nodemailer.createTransport({
		host: privateEnv.SMTP_HOST,
		port: Number(privateEnv.SMTP_PORT),
		secure: privateEnv.SMTP_SECURE === 'true',
		auth: { user: privateEnv.SMTP_USER, pass: privateEnv.SMTP_PASSWORD }
	});
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

export const savePrivateNote = async (input: PrivateNoteInput, fetcher: typeof globalThis.fetch) => {
	const verified = await verifyTurnstile(fetcher, input.turnstileToken, input.remoteIp);
	if (!verified) return { ok: false as const, status: 400, error: 'Please complete the spam check and try again.' };

	const id = crypto.randomUUID();
	const createdAt = Date.now();
	await mutateReaderDB((db) => {
		db.rows.push({ kind: 'note', id, anon_id: input.anonId, event: input.event, path: input.path, name: input.name, message: input.message, email_status: 'pending', created_at: createdAt });
	});

	let emailStatus: 'sent' | 'failed' = 'failed';
	const transporter = createTransporter();
	if (transporter) {
		const timestamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Europe/Amsterdam' }).format(new Date(createdAt));
		try {
			await transporter.sendMail({
				from: privateEnv.EMAIL_FROM,
				to: privateEnv.EMAIL_TO,
				subject: `Private blog note: ${input.storyTitle.replace(/[\r\n]+/g, ' ')}`,
				text: [`Story: ${input.storyTitle}`, `Page: ${input.path}`, `Name: ${input.name}`, `Sent: ${timestamp}`, '', input.message].join('\n')
			});
			emailStatus = 'sent';
		} catch {
			console.error('Private blog note email delivery failed', { noteId: id, event: input.event });
		}
	} else {
		console.error('Private blog note SMTP configuration is incomplete', { noteId: id });
	}

	await mutateReaderDB((db) => {
		const row = db.rows.find((entry) => entry.kind === 'note' && entry.id === id);
		if (row?.kind === 'note') row.email_status = emailStatus;
	});

	return { ok: true as const, emailStatus };
};
