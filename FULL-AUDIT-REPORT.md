# Full SEO and Performance Audit

Analyzed: 24 July 2026  
Site: https://blog.nickesselman.nl  
Implementation branch: `dev`  
Deployment status: not deployed

## Executive summary

The live production baseline remains **58/100** because production has not been changed. The completed `dev` implementation now passes its local technical release gates and reaches **100 Lighthouse SEO**, **100 accessibility**, **100 best practices**, and **97–99 performance** on representative routes.

The remaining gap to a perfect overall SEO health score is outside the authorized dev-only scope: the production HTTP redirect, Cloudflare cache policy, Search Console/field data, authority/backlinks, and content-level GEO improvements. Journal Markdown was deliberately left unchanged.

## Verified dev results

Three mobile Lighthouse runs were completed per route against the local production build:

| Route | Performance | Accessibility | Best practices | SEO | Median LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| Home | 99 | 100 | 100 | 100 | 1.99s | 0 | 0ms |
| About | 99 | 100 | 100 | 100 | 1.96s | 0 | 0ms |
| Florida | 97 | 100 | 100 | 100 | 2.41s | 0 | 0ms |
| Dutch Florida | 97 | 100 | 100 | 100 | 2.41s | 0 | 0ms |

These are lab results for `dev`, not production field data.

## Implemented

### Performance and media

- Generated and verified 480, 960, and 1600px WebP variants for CDN raster images.
- Added a generated 138-asset dimension manifest.
- Added mobile-specific hero selection, responsive `srcset`, exact preload candidates, intrinsic dimensions, and high LCP fetch priority.
- Reduced the Moonshot mobile hero from 4.61MB to 24KB.
- Added 9KB and 26KB responsive About portraits instead of sending the 131KB original.
- Self-hosted and preloaded the Space Grotesk font.
- Removed video autoplay from journal content and kept video requests behind explicit playback.
- Excluded videos from the About carousel’s initial network path.
- Deferred Immich and Turnstile work and retained zero initial blocking time.

### On-page SEO and images

- Added a typed, bilingual metadata registry for all five journals without editing their Markdown.
- Replaced generic search titles and descriptions with portfolio-oriented metadata.
- Added repository-backed publication and modification dates.
- Added useful sidecar alt metadata for generic media while preserving authored captions separately.
- Suppressed three malformed Moonshot media references without changing the journal source.
- Added related-story links outside the journal body.
- Verified 280 referenced original and responsive CDN URLs.

### Technical SEO and schema

- Verified canonicals, reciprocal hreflang, server-rendered language attributes, sitemap coverage, and the `/moonshot` 308 redirect.
- Added valid `WebSite`, `CollectionPage`, `ItemList`, `BlogPosting`, `BreadcrumbList`, `ProfilePage`, and `Person` JSON-LD.
- Added stable author identity links and accurate schema dates.
- Added `/llms.txt`, security headers, and a report-only Content Security Policy.
- Removed insecure/dead journal links at render time for both English and Dutch output.
- Fixed a client lifecycle exception, bringing Lighthouse best practices from 96 to 100.

## Automated gates

- `npm run check`: 0 errors and 0 warnings.
- `npm run validate:seo`: all story metadata, alt metadata, dates, relationships, and dimensions pass.
- `npm run build`: production build succeeds.
- `npm run validate:rendered`: all canonical English/Dutch pages, JSON-LD, redirects, sitemap URLs, and machine-readable endpoints pass.
- `npm run verify:cdn`: 280 CDN URLs pass.
- `npm run lighthouse`: all configured thresholds pass across 12 mobile runs.

## Remaining constraints

- Production HTTP still needs a one-hop HTTPS redirect configured at Cloudflare.
- Versioned image derivatives need a long immutable browser/edge cache policy.
- Production must be measured again after deployment; CrUX/INP require real-user traffic.
- Search Console, analytics, index coverage, and backlink data were unavailable.
- Content/GEO cannot reach its maximum because the approved scope excludes changes to journal prose, sourced overview passages, and contextual links inside articles.
