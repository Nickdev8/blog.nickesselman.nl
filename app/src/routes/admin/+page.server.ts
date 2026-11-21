import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { COOKIE_NAME, computeSignature } from '$lib/server/session';
import { buildSeo } from '$lib/seo';

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');
const SLUG_REGEX = /^[a-zA-Z0-9-_]+$/;

const resolveSlug = (slug: string) => {
	if (!SLUG_REGEX.test(slug)) {
		throw error(400, 'Invalid slug');
	}

	return path.join(POSTS_DIR, `${slug}.md`);
};

const extractLatestDate = (fileContent: string) => {
	const sections = fileContent.split('---').filter((s) => s.trim());
	const dates: number[] = [];
	for (let i = 1; i < sections.length; i += 2) {
		const fm = sections[i];
		const fmData = matter(`---\n${fm}\n---`).data || {};
		const ts = fmData.date ? new Date(fmData.date).getTime() : NaN;
		if (!Number.isNaN(ts)) {
			dates.push(ts);
		}
	}
	return dates.length ? Math.max(...dates) : 0;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const seo = buildSeo({
		title: 'Markdown Admin',
		description: 'Private admin interface for blog content.',
		pathname: '/admin',
		robots: 'noindex,nofollow,noarchive'
	});

	if (!locals.isAdmin) {
		return {
			seo,
			loggedIn: false,
			posts: [],
			selectedSlug: null,
			content: '',
			saved: false
		};
	}

	if (!fs.existsSync(POSTS_DIR)) {
		throw error(500, 'Posts directory not found');
	}

	const files = fs
		.readdirSync(POSTS_DIR)
		.filter((file) => file.endsWith('.md'));

	const posts = files.map((filename) => {
		const filePath = path.join(POSTS_DIR, filename);
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const { data } = matter(fileContent);
		const latestDate = extractLatestDate(fileContent);
		return {
			slug: filename.replace(/\.md$/, ''),
			title: data.title || filename,
			latestDate
		};
	}).sort((a, b) => (b.latestDate || 0) - (a.latestDate || 0));

	const requestedSlug = url.searchParams.get('post');
	const selectedSlug = requestedSlug && posts.some((post) => post.slug === requestedSlug)
		? requestedSlug
		: posts[0]?.slug;

	const content =
		selectedSlug && fs.existsSync(resolveSlug(selectedSlug))
			? fs.readFileSync(resolveSlug(selectedSlug), 'utf-8')
			: '';

	return {
		seo,
		loggedIn: true,
		posts,
		selectedSlug: selectedSlug ?? null,
		content,
		saved: url.searchParams.get('saved') === '1'
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const password = data.get('password');
		const adminPassword = env.ADMIN_PASSWORD;

		if (!adminPassword) {
			return fail(500, { loginError: 'ADMIN_PASSWORD is not configured on the server.' });
		}

		if (typeof password !== 'string' || password.length === 0) {
			return fail(400, { loginError: 'Password is required.' });
		}

		if (password !== adminPassword) {
			return fail(401, { loginError: 'Incorrect password.' });
		}

		cookies.set(COOKIE_NAME, computeSignature(adminPassword), {
			path: '/',
			httpOnly: true,
			secure: env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 12
		});

		throw redirect(303, '/admin');
	},
	logout: async ({ cookies }) => {
		cookies.delete(COOKIE_NAME, { path: '/' });
		throw redirect(303, '/admin');
	},
	save: async ({ request, locals }) => {
		if (!locals.isAdmin) {
			throw error(401, 'Unauthorized');
		}

		const data = await request.formData();
		const slug = data.get('slug');
		const content = data.get('content');

		if (typeof slug !== 'string' || !SLUG_REGEX.test(slug)) {
			return fail(400, { saveError: 'Invalid slug supplied.' });
		}

		if (typeof content !== 'string') {
			return fail(400, { saveError: 'Invalid content payload.' });
		}

		const filePath = resolveSlug(slug);

		if (!fs.existsSync(filePath)) {
			return fail(404, { saveError: 'Post not found.' });
		}

		const cleaned = await normalizeImages(content);

		fs.writeFileSync(filePath, cleaned.replace(/\r\n/g, '\n'), 'utf-8');

		throw redirect(303, `/admin?post=${encodeURIComponent(slug)}&saved=1`);
	}
};

const normalizeImages = async (input: string) => {
	const frontmatter = input.match(/^---[ 	]*\r?\n[\s\S]*?\r?\n---[ 	]*(?:\r?\n|$)/)?.[0] || '';
	let output = input.slice(frontmatter.length).replace(/!\[([^\]]*)\]\(([^)]+)\)\{[^}]*\}/g, '![$1]($2)');

	const shareRegex = /https?:\/\/photos\.nickesselman\.nl\/share\/([A-Za-z0-9_-]+)/gi;
	const shares = new Set<string>();
	for (const match of output.matchAll(shareRegex)) {
		if (match[0]) shares.add(match[0]);
	}

	for (const shareLink of shares) {
		const direct = await resolveImmichShare(shareLink);
		if (direct) {
			output = output.split(shareLink).join(direct);
		}
	}

	output = output.replace(/^\s*(https?:\/\/photos\.nickesselman\.nl[^\s]+)\s*$/gim, (match, url) => {
		const trimmed = match.trim();
		if (trimmed.startsWith('![') || trimmed.startsWith('[')) return match;
		return `![Immich photo](${url})`;
	});

	return frontmatter + output;
};

const resolveImmichShare = async (shareLink: string): Promise<string | null> => {
	try {
		const url = new URL(shareLink);
		const key = url.pathname.split('/').filter(Boolean).pop();
		if (!key) return null;

		const apiRes = await fetch(`${url.origin}/api/shared-link/${key}`, {
			headers: { accept: 'application/json' }
		});
		if (!apiRes.ok) return null;

		const data = await apiRes.json();
		const asset = data?.assets?.[0];
		const assetId = asset?.id || asset?.assetId;
		if (!assetId) return null;

		const candidate = `${url.origin}/api/assets/${assetId}?key=${key}`;
		return candidate;
	} catch (err) {
		console.error('Failed to resolve Immich share', err);
		return null;
	}
};
