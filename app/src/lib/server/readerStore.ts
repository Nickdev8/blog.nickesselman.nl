import fs from 'fs/promises';
import path from 'path';

export type ReaderRow =
	| {
			kind: 'visit';
			anon_id: string;
			path: string;
			referrer: string;
			device: 'mobile' | 'desktop';
			created_at: number;
	  }
	| {
			kind: 'post_view';
			anon_id: string;
			event: string;
			path: string;
			created_at: number;
	  }
	| {
			kind: 'name';
			anon_id: string;
			name: string;
			created_at: number;
	  }
	| {
			kind: 'language';
			anon_id: string;
			language: 'en' | 'nl';
			created_at: number;
	  }
	| {
			kind: 'scroll';
			anon_id: string;
			event: string;
			path: string;
			percent: number;
			created_at: number;
	  }
	| {
			kind: 'note';
			id: string;
			anon_id: string;
			event: string;
			path: string;
			name: string;
			message: string;
			email_status: 'pending' | 'sent' | 'failed';
			created_at: number;
	  };

export type ReaderDB = { rows: ReaderRow[] };

const FILE = process.env.READERS_FILE || path.resolve('data/readers.json');

let queue: Promise<void> = Promise.resolve();

const readSafe = async (): Promise<ReaderDB> => {
	try {
		return JSON.parse(await fs.readFile(FILE, 'utf8'));
	} catch {
		return { rows: [] };
	}
};

const writeSafe = async (db: ReaderDB) => {
	await fs.mkdir(path.dirname(FILE), { recursive: true });
	const tmp = `${FILE}.tmp`;
	await fs.writeFile(tmp, JSON.stringify(db), 'utf8');
	await fs.rename(tmp, FILE);
};

export const mutateReaderDB = async <T>(fn: (db: ReaderDB) => T | Promise<T>): Promise<T> => {
	const next = queue.then(async () => {
		const db = await readSafe();
		const result = await fn(db);
		await writeSafe(db);
		return result;
	});
	queue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
};

export const readReaderDB = async (): Promise<ReaderDB> => readSafe();
