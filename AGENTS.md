# Working on earlyworld

Read [docs/code-quality.md](docs/code-quality.md) before changing application code. Use [docs/architecture.md](docs/architecture.md) for data ownership and [docs/soundcloud.md](docs/soundcloud.md) for catalog operations.

- Preserve the navy/lavender branding and shared UI primitives. Design values live in `shared/brand.ts` and `shared/theme.ts`; remote artwork uses `src/components/Artwork.tsx`.
- Keep the interface expressive and informative, not empty. Preserve producer credits, source, saves, ratings, and useful screen introductions. The feed may use the earlyworld wordmark. Avoid LIVE badges, repeated catalog labels, and logos on every screen; do not interpret copy cleanup as removing meaningful detail.
- Preserve ratings, saves, favorites, matching, Rotation, and Studio credits when refactoring. SoundCloud supplies metadata only; the app has no audio player.
- Server state belongs in subscription-backed React providers, with account-scoped cleanup. Zustand holds local session state.
- Do not print `.env`, Firebase credentials, tokens, or review text in logs. Prefix Firebase tooling with `DEBUG=` to avoid inherited debug logging.
- Run `npm run check` after code changes. For backend accounting or rules changes, also run the relevant isolated emulator tests. Native dependency changes require a native development build.
- Review current SDK documentation before applying generic React Native advice. Prefer concrete fixes to speculative rewrites; record material remaining limitations honestly.
