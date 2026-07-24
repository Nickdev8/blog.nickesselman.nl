import fs from 'node:fs';

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'src/data/media-manifest.json';

if (!inputPath) {
	console.error('Usage: node scripts/generate-media-manifest.mjs <dimensions.tsv> [output.json]');
	process.exit(1);
}

const rows = fs
	.readFileSync(inputPath, 'utf8')
	.split(/\r?\n/)
	.filter(Boolean)
	.map((line) => {
		const [absolutePath, dimensions] = line.split('\t');
		const match = dimensions?.match(/^(\d+)x(\d+)$/);
		if (!absolutePath || !match) return null;
		const cdnPath = absolutePath.replace(/^.*\/blogimages\//, '/blogimages/');
		return [
			encodeURI(cdnPath),
			{
				width: Number(match[1]),
				height: Number(match[2])
			}
		];
	})
	.filter(Boolean)
	.sort(([left], [right]) => left.localeCompare(right));

fs.writeFileSync(outputPath, `${JSON.stringify(Object.fromEntries(rows), null, '\t')}\n`);
console.log(`Wrote ${rows.length} media records to ${outputPath}`);
