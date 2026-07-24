# Dev SEO and Performance Handoff

## Status

- Branch: `dev`
- Production deployment: not performed
- Journal Markdown: unchanged
- Local Lighthouse: 97–99 performance and 100 accessibility, best practices, and SEO

## Release checks

Run from `app/`:

```bash
npm ci
npm run quality
npm run verify:cdn
npm run lighthouse
```

`npm run lighthouse` requires a local Chrome/Chromium installation or `CHROME_PATH`. Reports are written to the ignored `app/.lighthouseci/` directory and are not uploaded.

## Deployment sequence

1. Commit only the intended dev changes and tag the current production revision for rollback.
2. Build without replacing persistent reaction/reader data:

   ```bash
   docker compose build web
   docker compose up -d web
   ```

3. Confirm the container is healthy, then validate:

   ```bash
   curl -I https://blog.nickesselman.nl/
   curl -I https://blog.nickesselman.nl/florida
   curl -I https://blog.nickesselman.nl/nl/florida
   curl -I https://blog.nickesselman.nl/sitemap.xml
   curl -I https://blog.nickesselman.nl/llms.txt
   ```

4. In Cloudflare, enable “Always Use HTTPS” and set a cache rule for versioned responsive WebP paths with a one-year browser/edge TTL.
5. Verify `http://blog.nickesselman.nl/<path>` returns one 301/308 hop to the equivalent HTTPS path.
6. Re-run Lighthouse and rendered SEO validation against production before removing the rollback point.

## Rollback conditions

Roll back if any canonical/sitemap URL returns non-200, hreflang pairs diverge, JSON-LD fails parsing, the legacy redirect changes destination, or mobile LCP exceeds 2.5s consistently.
