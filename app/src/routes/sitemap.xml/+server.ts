import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { RequestHandler } from './$types';
import { toAbsoluteUrl } from '$lib/seo';
import { publicPostSlug } from '$lib/postRoutes';

const POSTS_DIR = path.join(process.cwd(), 'src', 'posts');
const DUTCH_DIR = path.join(process.cwd(), 'src', 'translations', 'nl');

const escapeXml = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

const extractLatestDate = (fileContent: string, fallback: number) => {
	const sections = fileContent.split('---').filter((section) => section.trim());
	const dates: number[] = [];

	for (let index = 1; index < sections.length; index += 2) {
		const fm = sections[index];
		const fmData = matter(`---\n${fm}\n---`).data || {};
		const timestamp = fmData.date ? new Date(fmData.date).getTime() : NaN;
		if (!Number.isNaN(timestamp)) {
			dates.push(timestamp);
		}
	}

	if (dates.length === 0) return new Date(fallback).toISOString();
	return new Date(Math.max(...dates)).toISOString();
};

const readPostUrls = () => {
	if (!fs.existsSync(POSTS_DIR)) return [];

	const posts = fs
		.readdirSync(POSTS_DIR)
		.filter((file) => file.endsWith('.md'))
		.map((filename) => {
			const filePath = path.join(POSTS_DIR, filename);
			const fileContent = fs.readFileSync(filePath, 'utf-8');
			const stats = fs.statSync(filePath);

			return {
				loc: toAbsoluteUrl(`/${publicPostSlug(filename.replace(/\.md$/, ''))}`),
				lastmod: extractLatestDate(fileContent, stats.mtimeMs)
			};
		})
		.sort((a, b) => b.lastmod.localeCompare(a.lastmod));

	const dutch = posts
		.filter((post) => {
			const slug = new URL(post.loc).pathname.split('/').filter(Boolean).pop();
			return Boolean(slug && fs.existsSync(path.join(DUTCH_DIR, `${slug}.json`)));
		})
		.map((post) => ({ ...post, loc: post.loc.replace('blog.nickesselman.nl/', 'blog.nickesselman.nl/nl/') }));

	return [...posts, ...dutch];
};

export const GET: RequestHandler = () => {
	const urls = [
		{ loc: toAbsoluteUrl('/'), lastmod: undefined },
		{ loc: toAbsoluteUrl('/about'), lastmod: undefined },
		{ loc: toAbsoluteUrl('/nl'), lastmod: undefined },
		{ loc: toAbsoluteUrl('/nl/about'), lastmod: undefined },
		...readPostUrls()
	];

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...urls.map(
			({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `
    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}
  </url>`
		),
		'</urlset>'
	].join('\n');

	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
