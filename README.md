# Michiratagame 🐀

An absurd clicker: tap a rat with a cat's face, hear it squeak “ñiii,” buy upgrades, and unlock Michiratas with powers. No real-money purchases or subscriptions.

A project from a community of friends, developed with help from AI. The project's code and assets are available under the [MIT license](LICENSE).

<img src="arte/demo-dock-mobile.png" alt="Mobile demo showing Michirata, the score counter, upgrades, and skin selector" width="320">

## Features

- Responsive gameplay for phones and PCs, with the score counter and upgrade buttons always visible.
- Twenty-four skins with powers, automated workers, and multipliers every ten levels.
- Synthesized sound, particles, and animated stickers, with mute and animation controls. Swipe a reward sticker sideways to dismiss it.
- Local game saves with additive v1/v2 migration to v3; prestige, board record and deductions persist together.
- Steady play at 1–8 clicks/second earns a +10% click bonus after five seconds. Sustained play above 30 clicks/second for ten seconds pauses production and reduces wallet and leaderboard points by 1% per second, never below zero. Rest clears overheating; ordinary fatigue still applies.
- Rebirth at click/worker level 40 grants bigotes based on cumulative earnings. Keep skins and buy permanent click/production boosts (up to ×2) and upgrade discounts (up to 20%). Each claimed bigote adds 1% to the historical record on the leaderboard, capped at 25%; penalties are deducted. Confirm rebirth under Settings, separately from deleting a save.
- A backend with an active-player counter, public player names, and a leaderboard persisted in SQLite.

## Getting started

Requires Node.js 24 or later and npm. `.nvmrc` selects Node 24.

```bash
git clone https://github.com/Naraku86/michiratagame.git
cd michiratagame
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4174**. The server serves both the game and the API; no API keys, accounts, or external services are required.

For development, keep `npm start` running and open another terminal:

```bash
npm run dev
```

Vite prints its address and proxies `/api` to the backend on port 4174. Restart `npm start` after changing backend code.

```bash
npm test
npm run build
```

`npm run preview` serves only the frontend. Use `npm start` for player names, presence, and the leaderboard.

## Click fatigue

Click fatigue uses a 24-click burst allowance, replenished at eight clicks per second. Excess clicks add heat; one unit of heat recovers per second. Click rewards, including skin bonuses, are multiplied by `1 / (1 + heat / 20)^2`. There is no ban: sustained excessive clicking keeps earning progressively smaller rewards, while worker production stays unchanged.

The reduced per-click value and a short fatigue notice appear during play. Fatigue persists separately from game progress, so reloading or resetting the game does not clear it; elapsed rest time restores efficiency. Sound and particles are capped at about twelve feedback events per second during autoclicking.

This is a gameplay balancing mechanic, not verified bot detection. Existing leaderboard records are preserved. The backend still accepts client-reported scores, and a modified client can bypass this rule.

## Data and deployment

- The server listens on `127.0.0.1:4174`. To expose it publicly, use a reverse proxy or tunnel and serve the frontend and API under the same domain.
- `PORT` changes the port. `MICHI_DATA_DIR` changes the database directory (default: `data/`).
- `data/community.sqlite` stores names, records, and sessions and is excluded from Git. Preserve this directory between deployments. Stop the server before backing it up, including any SQLite sidecar files that exist.
- Game progress is stored in the browser, not on the server. It does not sync between devices and does not generate points while the tab is hidden.
- “Active” means a visible browser has sent a presence update within the last minute. Updates are sent every twenty seconds; tabs share an identity through a cookie.
- The leaderboard keeps the highest reported point balance, even after spending points or resetting the game. Peaks that have not yet been sent may be lost when closing the page.
- Clearing cookies, switching devices, or changing domains creates a new identity. Names are not verified accounts and may be duplicated.
- Scores are reported by the client: this demo's leaderboard is not cheat-resistant.

## Suspicious leaderboard records

The server watches increases in reported records. Its generous allowance is ten million points per elapsed second plus a forty-million-point burst reserve; repeated reports cannot reuse that reserve. This sits above normal worker production and fatigue-limited tapping in the current game.

A record that exceeds the allowance receives the public **“Tramposo · sospecha”** (suspected cheater) badge and is sorted below all unflagged players. The board shows up to fifty unflagged records followed by up to ten flagged records; personal rank uses the same ordering across all players. Flags persist through renaming and server restarts. Players can still play, buy upgrades, and change their names.

The first report establishes a baseline, including imported saves and existing records after migration. A high historical score alone is not evidence, so old records are not automatically flagged. This heuristic can miss manipulation or produce false positives; it is not proof of cheating, and using an autoclicker alone does not trigger a flag. An administrator can clear a reviewed flag locally in SQLite by setting that player's `suspected` and `checked_at` to zero, which establishes a fresh baseline on the next update. There is no public flag-clearing endpoint.

## Project structure

| Directory | Contents |
| --- | --- |
| `src/` | Economy, UI, audio, saves, community client, and tests |
| `server/` | HTTP backend, SQLite storage, and integration tests |
| `public/assets/` | Images for 24 Michiratas and the original reward animations |
| `arte/` | Demo screenshot and concept art; the concept does not represent implemented features |
| `docs/` | Historical context, research, and development plans |

Voting and AI moderation remain future ideas. Optional accounts are prepared with Supabase; enable them only after configuring the providers, SMTP, and redirects. Prestige has an executable prototype and analysis, but is not active in the game. Historical documents may describe earlier versions; use this README to run the current version. The game UI and supporting documents are currently in Spanish.

## Development tools and roadmap

```bash
npm run balance             # deterministic economy matrix: 24 skins, 1,296 scenarios
npm run prestige:simulate   # proposed reset rewards and repeated-run comparisons
npm run package:itch        # HTML5 ZIP with relative assets and license notices
node --experimental-strip-types tools/load-local.ts  # bounded local load probe
npm run audit:local         # reproduces known cheat vectors locally; fixed cases report differently
```

`npm test` includes the simulation and authentication tests; the build type-checks `src/`, `server/`, and `tools/`. The seven parallel work streams, delivered reports, and remaining work are tracked in [docs/DESARROLLO_PARALELO.md](docs/DESARROLLO_PARALELO.md).

Accounts: copy `.env.example` to `.env`, configure Supabase plus Google/Facebook/email using [the setup checklist](docs/AUTENTICACION.md), then rebuild and restart. `npm start` loads `.env` if present. The public demo has no account keys configured; tests use simulated HTTP responses. Browser keys must be publishable/anon: the build rejects secret or legacy service-role keys before bundling.

The backend limits API traffic, new identity creation, static requests, connections, and body size. Assets stream rather than buffering each image. [The protection report](docs/PROTECCION_SERVIDOR.md) separates these controls from DNSSEC/WAF settings that require a permanent domain and Cloudflare configuration. [The audit queue](docs/COLA_DE_CORRECCIONES.md) tracks remaining cheat vectors; accounts and rate limits do not make client-reported scores authoritative.

## Contributing

Open an [issue](https://github.com/Naraku86/michiratagame/issues) with a bug or idea, or submit a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and artwork

[MIT](LICENSE). Covers the project's code and original assets. Dependencies retain their own licenses. The license does not grant rights to third-party trademarks or elements depicted in images.

The community supplied the Michirata images and variants; the concept art was generated with AI. The original animated WebP files have been preserved. See [public/assets/README.md](public/assets/README.md) for details.
