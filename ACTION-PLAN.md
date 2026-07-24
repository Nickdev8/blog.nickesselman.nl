# SEO Action Plan

## Completed on `dev`

- Responsive CDN image delivery and intrinsic dimensions.
- Mobile hero and About portrait optimization.
- Self-hosted font and critical-request cleanup.
- Video, Immich, and Turnstile deferral.
- Bilingual story metadata, schema, canonicals, hreflang, and language output.
- Sidecar image alt metadata with no journal Markdown edits.
- Related-story navigation and visible author attribution.
- Sitemap dates, legacy redirect, security headers, CSP report-only policy, and `/llms.txt`.
- Automated static, rendered, CDN, build, and Lighthouse gates.

## Required at deployment

1. Run the full dev validation and create a rollback tag.
2. Deploy all routing, metadata, schema, and responsive-image changes atomically.
3. Enable Cloudflare “Always Use HTTPS”; verify HTTP redirects to the same HTTPS path in one hop.
4. Apply a one-year immutable cache policy to versioned `*-w480.webp`, `*-w960.webp`, and `*-w1600.webp` assets.
5. Re-run the rendered validator and Lighthouse against production.
6. Submit the sitemap and inspect Home, About, Florida, and one Dutch URL in Google Search Console.

## After deployment

- Collect p75 LCP, INP, and CLS field data for at least 28 days.
- Monitor index coverage, hreflang selection, branded queries, portfolio referrals, and AI citations.
- Pursue legitimate links from Hack Club event/project pages and personal project profiles.
- If journal edits are authorized later, add sourced answer-first event summaries and contextual internal links; these are the largest remaining content/GEO gains.
