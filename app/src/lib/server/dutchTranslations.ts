import fs from 'fs';
import path from 'path';
import { sanitizeJournalHtml } from '$lib/server/journalHtml';

export type DutchTranslation = {
	sourceHash: string;
	generatedAt: string;
	title: string;
	description: string;
	warning?: string;
	entries: {
		title: string;
		blocks: ({ type: 'text'; html: string } | { type: 'media'; alt: string })[];
	}[];
};

const TRANSLATIONS_DIR = path.join(process.cwd(), 'src', 'translations', 'nl');

export const readDutchTranslation = (slug: string): DutchTranslation | null => {
	const file = path.join(TRANSLATIONS_DIR, `${slug}.json`);
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8')) as DutchTranslation;
	} catch {
		return null;
	}
};

type PostPageData = {
	title: string;
	description: string;
	banner?: { message: string } | null;
	posts: {
		title: string;
		blocks: ({ type: 'text'; html: string } | { type: 'media'; media: { alt: string } })[];
	}[];
};

export const applyDutchTranslation = <T extends PostPageData>(
	data: T,
	translation: DutchTranslation
): T => ({
	...data,
	title: translation.title,
	description: translation.description,
	banner:
		data.banner && translation.warning
			? { ...data.banner, message: translation.warning }
			: data.banner,
	posts: data.posts.map((post, entryIndex) => {
		const translatedEntry = translation.entries[entryIndex];
		return {
			...post,
			title: translatedEntry?.title || post.title,
			blocks: post.blocks.map((block, blockIndex) => {
				const translatedBlock = translatedEntry?.blocks[blockIndex];
				if (block.type === 'text' && translatedBlock?.type === 'text') {
					return { ...block, html: sanitizeJournalHtml(translatedBlock.html) };
				}
				if (block.type === 'media' && translatedBlock?.type === 'media') {
					const translatedAlt = translatedBlock.alt?.trim();
					const hasUsefulTranslatedAlt =
						Boolean(translatedAlt) &&
						!/^(?:alt text|afbeelding|image|photo|foto|extra image)$/i.test(translatedAlt);
					return hasUsefulTranslatedAlt
						? { ...block, media: { ...block.media, alt: translatedAlt } }
						: block;
				}
				return block;
			})
		};
	})
});
