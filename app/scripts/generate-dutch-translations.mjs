import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const appRoot = process.cwd();
const postsDir = path.join(appRoot, 'src', 'posts');
const outputDir = path.join(appRoot, 'src', 'translations', 'nl');
const envFiles = [path.resolve(appRoot, '..', '.env'), path.join(appRoot, '.env')];

for (const file of envFiles) {
	if (!fs.existsSync(file)) continue;
	for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match || process.env[match[1]] !== undefined) continue;
		process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
	}
}

const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

const protectedWords = (process.env.PUBLIC_NO_TRANSLATE_WORDS || 'Neighborhood,Shipwrecked,Undercity,Hack Club')
	.split(/[,\n]/)
	.map((word) => word.trim())
	.filter(Boolean)
	.sort((a, b) => b.length - a.length);

const publicSlug = (sourceSlug) => sourceSlug === 'moonshot' ? 'florida' : sourceSlug;
const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

const protectWords = (value) => {
	let output = value;
	const originals = [];
	for (const word of protectedWords) {
		output = output.replace(
			new RegExp(`\\b(${escapeRegex(word)})\\b`, 'gi'),
			(match) => {
				const index = originals.push(match) - 1;
				return `ZXQNT${index}QXZ`;
			}
		);
	}
	return { output, originals };
};

const removeProtection = (value, originals) =>
	value.replace(/ZXQNT(\d+)QXZ/gi, (token, index) => originals[Number(index)] ?? token);

const decodeEntities = (value) => value
	.replace(/&quot;/g, '"')
	.replace(/&#39;|&apos;/g, "'")
	.replace(/&amp;/g, '&')
	.replace(/&lt;/g, '<')
	.replace(/&gt;/g, '>')
	.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const translateWithCloud = async (values) => {
	const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ q: values, source: 'en', target: 'nl', format: 'html' })
	});
	if (!response.ok) {
		const message = await response.text();
		throw new Error(`Google Cloud Translation failed (${response.status}): ${message.slice(0, 500)}`);
	}
	const payload = await response.json();
	return payload.data.translations.map((entry) => entry.translatedText);
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const translatePublicValue = async (value, attempt = 0) => {
	const response = await fetch('https://translate.googleapis.com/translate_a/single', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'nl', dt: 't', q: value })
	});
	if (!response.ok) {
		if (response.status === 429 && attempt < 6) {
			const retryAfter = Number(response.headers.get('retry-after')) * 1000;
			const delay = Number.isFinite(retryAfter) && retryAfter > 0
				? Math.min(retryAfter, 15000)
				: Math.min(1000 * 2 ** attempt, 15000);
			await wait(delay);
			return translatePublicValue(value, attempt + 1);
		}
		throw new Error(`Automatic translation failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
	}
	const payload = await response.json();
	const translated = Array.isArray(payload?.[0])
		? payload[0].map((part) => Array.isArray(part) ? part[0] || '' : '').join('')
		: '';
	if (!translated) throw new Error('Automatic translation returned an empty response.');
	return translated;
};

const translatePublicBatch = async (values) => {
	const combined = values.map((value, index) => `ZXQSEG${index}QXZ\n${value}`).join('\n');
	const translated = await translatePublicValue(combined);
	const parts = translated.split(/ZXQSEG(\d+)QXZ\s*/gi);
	const results = new Array(values.length);
	for (let index = 1; index < parts.length; index += 2) {
		results[Number(parts[index])] = parts[index + 1]?.trim() || '';
	}
	if (results.some((value) => !value)) {
		throw new Error('Automatic translation did not preserve the batch boundaries.');
	}
	return results;
};

const translateBatch = async (values) => {
	const protectedValues = values.map(protectWords);
	const translated = apiKey
		? await translateWithCloud(protectedValues.map((value) => value.output))
		: await translatePublicBatch(protectedValues.map((value) => value.output));
	return translated.map((value, index) => removeProtection(value, protectedValues[index].originals));
};

const translateItems = async (items) => {
	let batch = [];
	let chars = 0;
	const flush = async () => {
		if (batch.length === 0) return;
		const translated = await translateBatch(batch.map((item) => item.value));
		batch.forEach((item, index) => item.set(item.html ? translated[index] : decodeEntities(translated[index])));
		batch = [];
		chars = 0;
	};

	for (const item of items) {
		if (batch.length >= 80 || chars + item.value.length > 25000) await flush();
		batch.push(item);
		chars += item.value.length;
	}
	await flush();
};

const buildTranslation = (source) => {
	const sections = source.split('---').filter((section) => section.trim());
	const mainData = matter(`---\n${sections[0] || ''}\n---`).data || {};
	const result = {
		sourceHash: '',
		generatedAt: '',
		title: String(mainData.title || ''),
		description: String(mainData.description || ''),
		...(mainData.warning ? { warning: String(mainData.warning) } : {}),
		entries: []
	};
	const items = [];
	if (result.title) items.push({ value: result.title, html: false, set: (value) => { result.title = value; } });
	if (result.description) items.push({ value: result.description, html: false, set: (value) => { result.description = value; } });
	if (result.warning) items.push({ value: result.warning, html: false, set: (value) => { result.warning = value; } });

	for (let index = 1; index < sections.length; index += 2) {
		const parsed = matter(`---\n${sections[index]}\n---\n${sections[index + 1] || ''}`);
		if (!parsed.data.date || !parsed.data.title) continue;
		const entry = { title: String(parsed.data.title), blocks: [] };
		items.push({ value: entry.title, html: false, set: (value) => { entry.title = value; } });

		const mediaRegex = /!\[(.*?)\]\((.*?)\)(?:\{(.*?)\})?/gs;
		let lastIndex = 0;
		let match;
		while ((match = mediaRegex.exec(parsed.content))) {
			const preceding = parsed.content.slice(lastIndex, match.index);
			if (preceding.trim()) {
				const block = { type: 'text', html: marked.parse(preceding) };
				entry.blocks.push(block);
				items.push({ value: block.html, html: true, set: (value) => { block.html = value; } });
			}
			const block = { type: 'media', alt: (match[1] || '').trim() };
			entry.blocks.push(block);
			if (block.alt) items.push({ value: block.alt, html: false, set: (value) => { block.alt = value; } });
			lastIndex = match.index + match[0].length;
		}
		const remaining = parsed.content.slice(lastIndex);
		if (remaining.trim()) {
			const block = { type: 'text', html: marked.parse(remaining) };
			entry.blocks.push(block);
			items.push({ value: block.html, html: true, set: (value) => { block.html = value; } });
		}
		result.entries.push(entry);
	}
	return { result, items };
};

const generateAll = async () => {
	fs.mkdirSync(outputDir, { recursive: true });
	const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md')).sort();

	for (const filename of files) {
		const source = fs.readFileSync(path.join(postsDir, filename), 'utf8');
		const slug = publicSlug(filename.replace(/\.md$/, ''));
		const outputFile = path.join(outputDir, `${slug}.json`);
		const sourceHash = crypto.createHash('sha256')
			.update('automatic-dutch-v3\0')
			.update(source)
			.update('\0')
			.update(protectedWords.join('\n'))
			.digest('hex');
		if (fs.existsSync(outputFile)) {
			try {
				if (JSON.parse(fs.readFileSync(outputFile, 'utf8')).sourceHash === sourceHash) {
					console.log(`${slug}: unchanged`);
					continue;
				}
			} catch {
				// Regenerate invalid output.
			}
		}

		const { result, items } = buildTranslation(source);
		console.log(`${slug}: translating ${items.length} text blocks`);
		await translateItems(items);
		result.sourceHash = sourceHash;
		result.generatedAt = new Date().toISOString();
		fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
	}

	console.log('Dutch translations are up to date.');
};

if (!process.argv.includes('--skip-initial')) await generateAll();

if (process.argv.includes('--watch')) {
	let timer;
	let running = false;
	let rerun = false;
	const queueGeneration = () => {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			if (running) {
				rerun = true;
				return;
			}
			running = true;
			do {
				rerun = false;
				try {
					await generateAll();
				} catch (error) {
					console.error(error instanceof Error ? error.message : error);
				}
			} while (rerun);
			running = false;
		}, 350);
	};

	fs.watch(postsDir, { persistent: true }, (_event, filename) => {
		if (filename?.endsWith('.md')) queueGeneration();
	});
	console.log(`Watching ${postsDir} for English post changes.`);
}
