module.exports = {
	ci: {
		collect: {
			startServerCommand:
				'HOST=127.0.0.1 PORT=4174 NODE_ENV=production node build/index.js',
			startServerReadyPattern: 'Listening on',
			url: [
				'http://127.0.0.1:4174/',
				'http://127.0.0.1:4174/about',
				'http://127.0.0.1:4174/florida',
				'http://127.0.0.1:4174/nl/florida'
			],
			numberOfRuns: 3,
			settings: {
				chromeFlags: '--headless --no-sandbox --disable-dev-shm-usage'
			}
		},
		assert: {
			assertions: {
				'categories:performance': ['error', { minScore: 0.95 }],
				'categories:accessibility': ['error', { minScore: 0.95 }],
				'categories:best-practices': ['error', { minScore: 0.95 }],
				'categories:seo': ['error', { minScore: 1 }],
				'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
				'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
				'total-blocking-time': ['error', { maxNumericValue: 150 }]
			}
		},
		upload: {
			target: 'filesystem',
			outputDir: '.lighthouseci'
		}
	}
};
