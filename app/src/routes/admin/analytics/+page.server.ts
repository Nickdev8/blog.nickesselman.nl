import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { PageServerLoad } from './$types';
import { readReaderDB, type ReaderRow } from '$lib/server/readerStore';
import { buildSeo } from '$lib/seo';

type PostSummary = {
	slug: string;
	title: string;
};

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');
const VISIT_WINDOW_DAYS = 30;

const toDateKey = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const buildVisitSeries = (rows: { created_at: number }[], days: number) => {
	const dayMs = 24 * 60 * 60 * 1000;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const start = new Date(today.getTime() - (days - 1) * dayMs);
	const startTime = start.getTime();
	const counts = new Map<string, number>();

	for (const row of rows) {
		if (row.created_at < startTime) continue;
		const date = new Date(row.created_at);
		date.setHours(0, 0, 0, 0);
		if (date < start) continue;
		const key = toDateKey(date);
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	return Array.from({ length: days }, (_, index) => {
		const date = new Date(start.getTime() + index * dayMs);
		const key = toDateKey(date);
		return {
			date: key,
			timestamp: date.getTime(),
			count: counts.get(key) || 0
		};
	});
};

const readPosts = (): PostSummary[] => {
	if (!fs.existsSync(POSTS_DIR)) return [];
	return fs
		.readdirSync(POSTS_DIR)
		.filter((file) => file.endsWith('.md'))
		.map((filename) => {
			const filePath = path.join(POSTS_DIR, filename);
			const fileContent = fs.readFileSync(filePath, 'utf-8');
			const { data } = matter(fileContent);
			return {
				slug: filename.replace(/\.md$/, ''),
				title: data.title || filename
			};
		});
};

const normalizeHost = (value: string) => value.replace(/^www\./, '');
const isVisitRow = (row: ReaderRow): row is Extract<ReaderRow, { kind: 'visit' }> =>
	row.kind === 'visit';
const isPostViewRow = (row: ReaderRow): row is Extract<ReaderRow, { kind: 'post_view' }> =>
	row.kind === 'post_view';
const isNameRow = (row: ReaderRow): row is Extract<ReaderRow, { kind: 'name' }> => row.kind === 'name';
const isLanguageRow = (row: ReaderRow): row is Extract<ReaderRow, { kind: 'language' }> =>
	row.kind === 'language';
const isNoteRow = (row: ReaderRow): row is Extract<ReaderRow, { kind: 'note' }> =>
	row.kind === 'note';

const bucketReferrer = (referrer: string, siteOrigin: string) => {
	const value = referrer.trim();
	if (!value || value.toLowerCase() === 'direct') return 'direct';
	if (value.startsWith('/')) return 'internal';

	try {
		const parsed = new URL(value);
		if (parsed.origin === siteOrigin) return 'internal';
		return normalizeHost(parsed.hostname.toLowerCase());
	} catch {
		if (value.startsWith('http://') || value.startsWith('https://')) {
			const host = value.replace(/^https?:\/\//, '').split('/')[0] || '';
			return host ? normalizeHost(host.toLowerCase()) : 'external';
		}
		return 'external';
	}
};

const isPublicPath = (value: string) => !value.startsWith('/admin');

export const load: PageServerLoad = async ({ locals, url }) => {
	const seo = buildSeo({
		title: 'Reader Analytics',
		description: 'Private analytics dashboard for the blog.',
		pathname: '/admin/analytics',
		robots: 'noindex,nofollow,noarchive'
	});

	if (!locals.isAdmin) {
		return {
			seo,
			loggedIn: false,
			totals: null,
			perPost: [],
			deviceCounts: [],
			referrerCounts: [],
			languageCounts: [],
			names: [],
			notes: [],
			readerBreakdown: [],
			visitSeries: []
		};
	}

	const posts = readPosts();
	const titleMap = new Map(posts.map((post) => [post.slug, post.title]));

	const db = await readReaderDB();
	const rows = db.rows ?? [];

	const visitRows = rows.filter(isVisitRow).filter((row) => isPublicPath(row.path));
	const postRows = rows.filter(isPostViewRow);
	const nameRows = rows.filter(isNameRow);
	const languageRows = rows.filter(isLanguageRow);
	const noteRows = rows.filter(isNoteRow);

	const uniqueReaders = new Set(visitRows.map((row) => row.anon_id));
	const totalVisits = visitRows.length;
	const totalPostViews = postRows.length;

	const deviceMap = new Map<string, number>();
	for (const row of visitRows) {
		deviceMap.set(row.device, (deviceMap.get(row.device) || 0) + 1);
	}

	const referrerMap = new Map<string, number>();
	const firstReferrer = new Map<string, { created_at: number; referrer: string }>();
	const devicesByReader = new Map<string, Set<string>>();
	const sortedVisitRows = [...visitRows].sort((a, b) => a.created_at - b.created_at);

	for (const row of sortedVisitRows) {
		if (!firstReferrer.has(row.anon_id)) {
			firstReferrer.set(row.anon_id, { created_at: row.created_at, referrer: row.referrer });
		}
		const deviceSet = devicesByReader.get(row.anon_id) ?? new Set<string>();
		deviceSet.add(row.device);
		devicesByReader.set(row.anon_id, deviceSet);
	}

	for (const entry of firstReferrer.values()) {
		const bucket = bucketReferrer(entry.referrer, url.origin);
		referrerMap.set(bucket, (referrerMap.get(bucket) || 0) + 1);
	}

	const languageLatest = new Map<string, { language: 'en' | 'nl'; created_at: number }>();
	for (const row of languageRows) {
		const current = languageLatest.get(row.anon_id);
		if (!current || row.created_at > current.created_at) {
			languageLatest.set(row.anon_id, { language: row.language, created_at: row.created_at });
		}
	}
	const languageCounts = Array.from(languageLatest.values()).reduce<Record<string, number>>(
		(acc, row) => {
			acc[row.language] = (acc[row.language] || 0) + 1;
			return acc;
		},
		{}
	);

	const nameLatest = new Map<string, { name: string; created_at: number }>();
	for (const row of nameRows) {
		const current = nameLatest.get(row.anon_id);
		if (!current || row.created_at > current.created_at) {
			nameLatest.set(row.anon_id, { name: row.name, created_at: row.created_at });
		}
	}

	const visitCountsByReader = new Map<string, number>();
	const lastSeenByReader = new Map<string, number>();
	for (const row of visitRows) {
		visitCountsByReader.set(row.anon_id, (visitCountsByReader.get(row.anon_id) || 0) + 1);
		const currentLastSeen = lastSeenByReader.get(row.anon_id) || 0;
		if (row.created_at > currentLastSeen) {
			lastSeenByReader.set(row.anon_id, row.created_at);
		}
	}

	const namesByLabel = new Map<
		string,
		{
			name: string;
			lastSeen: number;
			visitCount: number;
			nameCount: number;
			devices: Set<string>;
			firstReferrers: Set<string>;
		}
	>();

	for (const [anonId, entry] of nameLatest.entries()) {
		const aggregate =
			namesByLabel.get(entry.name) ?? {
				name: entry.name,
				lastSeen: 0,
				visitCount: 0,
				nameCount: 0,
				devices: new Set<string>(),
				firstReferrers: new Set<string>()
			};
		const lastSeen = lastSeenByReader.get(anonId) || entry.created_at;
		aggregate.lastSeen = Math.max(aggregate.lastSeen, lastSeen);
		aggregate.visitCount += visitCountsByReader.get(anonId) || 0;
		aggregate.nameCount += 1;
		const devices = devicesByReader.get(anonId);
		if (devices) {
			for (const device of devices) aggregate.devices.add(device);
		}
		aggregate.firstReferrers.add(
			bucketReferrer(firstReferrer.get(anonId)?.referrer || 'direct', url.origin)
		);
		namesByLabel.set(entry.name, aggregate);
	}

	const names = Array.from(namesByLabel.values())
		.map((entry) => ({
			name: entry.name,
			lastSeen: entry.lastSeen,
			visitCount: entry.visitCount,
			nameCount: entry.nameCount,
			devices: Array.from(entry.devices),
			firstReferrer:
				entry.firstReferrers.size === 1
					? Array.from(entry.firstReferrers)[0]
					: 'mixed'
		}))
		.sort((a, b) => {
			if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
			return b.lastSeen - a.lastSeen;
		});

	const perPostMap = new Map<
		string,
		{
			slug: string;
			title: string;
			totalViews: number;
			uniqueReaders: Set<string>;
		}
	>();
	for (const row of postRows) {
		const entry = perPostMap.get(row.event) ?? {
			slug: row.event,
			title: titleMap.get(row.event) || row.event,
			totalViews: 0,
			uniqueReaders: new Set<string>()
		};
		entry.totalViews += 1;
		entry.uniqueReaders.add(row.anon_id);
		perPostMap.set(row.event, entry);
	}

	const readerBreakdownMap = new Map<
		string,
		{ name: string; posts: Map<string, { event: string; title: string; lastSeen: number }> }
	>();

	for (const row of postRows) {
		const nameEntry = nameLatest.get(row.anon_id);
		if (!nameEntry) continue;
		const existing =
			readerBreakdownMap.get(nameEntry.name) ?? { name: nameEntry.name, posts: new Map() };
		const currentPost = existing.posts.get(row.event);
		if (!currentPost || row.created_at > currentPost.lastSeen) {
			existing.posts.set(row.event, {
				event: row.event,
				title: titleMap.get(row.event) || row.event,
				lastSeen: row.created_at
			});
		}
		readerBreakdownMap.set(nameEntry.name, existing);
	}

	const perPost = Array.from(perPostMap.values())
		.map((entry) => ({
			slug: entry.slug,
			title: entry.title,
			totalViews: entry.totalViews,
			uniqueReaders: entry.uniqueReaders.size
		}))
		.sort((a, b) => b.totalViews - a.totalViews);

	return {
		seo,
		loggedIn: true,
		totals: {
			totalVisits,
			totalPostViews,
			uniqueReaders: uniqueReaders.size,
			uniqueNamedReaders: nameLatest.size
		},
		perPost,
		deviceCounts: Array.from(deviceMap.entries()).sort((a, b) => b[1] - a[1]),
		referrerCounts: Array.from(referrerMap.entries()).sort((a, b) => b[1] - a[1]),
		languageCounts: Object.entries(languageCounts).sort((a, b) => b[1] - a[1]),
		notes: noteRows
			.map((row) => ({
				id: row.id,
				event: row.event,
				storyTitle: titleMap.get(row.event) || row.event,
				name: row.name,
				message: row.message,
				emailStatus: row.email_status,
				createdAt: row.created_at
			}))
			.sort((a, b) => b.createdAt - a.createdAt),
		names,
		readerBreakdown: Array.from(readerBreakdownMap.values())
			.map((reader) => ({
				name: reader.name,
				posts: Array.from(reader.posts.values()).sort((a, b) => b.lastSeen - a.lastSeen)
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		visitSeries: buildVisitSeries(visitRows, VISIT_WINDOW_DAYS)
	};
};
