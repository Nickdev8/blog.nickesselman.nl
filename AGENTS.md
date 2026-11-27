# Blog agent checkpoint

- App code lives in `app/`; run `npm run check` there before handoff.
- Reader notes are saved by `app/src/lib/server/privateNote.ts` and delivered to ntfy. Delivery state is stored in `app/data/readers.json`; admins can retry failed notes in `/admin/analytics`.
- Production uses `docker-compose.yml` with explicit DNS because Docker omitted the host's Tailscale resolver. A live container lookup returned `EAI_AGAIN` before this fix; an ephemeral container with the configured resolvers reached ntfy successfully.
- As of 2026-10-03, the source fix passed checks and build, but production deployment and retry of the latest failed note are pending approval.
- Do not commit secrets or reader data. Follow `agent.md` for project design and deployment context.

- 2026-11-27: Local ntfy migration uses self-hosted `blognickesselmannotes` and private NTFY_TOKEN plus optional NTFY_NOTES_URL. Credentials in ignored root .env.prod and app/.env. Typecheck, Vite production build and mocked authenticated-delivery check pass. Full local npm build translation pre-step was DNS-blocked. Latest server edit to app/src/posts/juice.md copied locally for version control. Production ntfy-only environment patch backed up; web rebuilt and deployed. Labelled ntfy test from deployed container returned200; blog homepage200. Server post checksum matches local; all non-ntfy environment lines match the backup.
