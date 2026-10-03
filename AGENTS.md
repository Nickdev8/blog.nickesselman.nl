# Blog agent checkpoint

- App code lives in `app/`; run `npm run check` there before handoff.
- Reader notes are saved by `app/src/lib/server/privateNote.ts` and delivered to ntfy. Delivery state is stored in `app/data/readers.json`; admins can retry failed notes in `/admin/analytics`.
- Production uses `docker-compose.yml` with explicit DNS because Docker omitted the host's Tailscale resolver. A live container lookup returned `EAI_AGAIN` before this fix; an ephemeral container with the configured resolvers reached ntfy successfully.
- As of 2026-10-03, the source fix passed checks and build, but production deployment and retry of the latest failed note are pending approval.
- Do not commit secrets or reader data. Follow `agent.md` for project design and deployment context.
