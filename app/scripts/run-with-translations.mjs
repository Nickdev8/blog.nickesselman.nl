import { spawn } from 'node:child_process';
import path from 'node:path';

const appRoot = process.cwd();
const generator = path.join(appRoot, 'scripts', 'generate-dutch-translations.mjs');
const [target, ...targetArgs] = process.argv.slice(2);

if (!target) {
	console.error('A Node entry point is required.');
	process.exit(1);
}

const run = (args) => spawn(process.execPath, args, { cwd: appRoot, stdio: 'inherit', env: process.env });
const initial = run([generator]);
const initialExit = await new Promise((resolve) => initial.once('exit', (code) => resolve(code ?? 1)));
if (initialExit !== 0) {
	console.warn('Translation refresh failed; starting with the most recent generated Dutch content.');
}

const watcher = run([generator, '--watch', '--skip-initial']);
const application = run([path.resolve(appRoot, target), ...targetArgs]);

const stop = (signal) => {
	watcher.kill(signal);
	application.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

application.once('exit', (code, signal) => {
	watcher.kill('SIGTERM');
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 0);
});
