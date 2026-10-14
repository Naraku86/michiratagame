# Michiratagame 🐀

An absurd clicker: tap a rat with a cat's face, hear it squeak “ñiii,” buy upgrades, and unlock Michiratas with powers. No real-money purchases or subscriptions.

A project from a community of friends, developed with help from AI. The project's code and assets are available under the [MIT license](LICENSE).

<img src="arte/demo-dock-mobile.png" alt="Mobile demo showing Michirata, the score counter, upgrades, and skin selector" width="320">

## Features

- Responsive gameplay for phones and PCs, with the score counter and upgrade buttons always visible.
- Six skins with powers, automated workers, and multipliers every ten levels.
- Synthesized sound, particles, and animated stickers, with mute and animation controls. Swipe a reward sticker sideways to dismiss it.
- Local game saves.
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

## Data and deployment

- The server listens on `127.0.0.1:4174`. To expose it publicly, use a reverse proxy or tunnel and serve the frontend and API under the same domain.
- `PORT` changes the port. `MICHI_DATA_DIR` changes the database directory (default: `data/`).
- `data/community.sqlite` stores names, records, and sessions and is excluded from Git. Preserve this directory between deployments. Stop the server before backing it up, including any SQLite sidecar files that exist.
- Game progress is stored in the browser, not on the server. It does not sync between devices and does not generate points while the tab is hidden.
- “Active” means a visible browser has sent a presence update within the last minute. Updates are sent every twenty seconds; tabs share an identity through a cookie.
- The leaderboard keeps the highest reported point balance, even after spending points or resetting the game. Peaks that have not yet been sent may be lost when closing the page.
- Clearing cookies, switching devices, or changing domains creates a new identity. Names are not verified accounts and may be duplicated.
- Scores are reported by the client: this demo's leaderboard is not cheat-resistant.

## Project structure

| Directory | Contents |
| --- | --- |
| `src/` | Economy, UI, audio, saves, community client, and tests |
| `server/` | HTTP backend, SQLite storage, and integration tests |
| `public/assets/` | Images for six Michiratas and two animated WebP stickers |
| `arte/` | Demo screenshot and concept art; the concept does not represent implemented features |
| `docs/` | Historical context, research, and development plans |

Voting, AI moderation, and accounts with external identity providers are future ideas. Historical documents may describe earlier versions; use this README to run the current version. The game UI and supporting documents are currently in Spanish.

## Contributing

Open an [issue](https://github.com/Naraku86/michiratagame/issues) with a bug or idea, or submit a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and artwork

[MIT](LICENSE). Covers the project's code and original assets. Dependencies retain their own licenses. The license does not grant rights to third-party trademarks or elements depicted in images.

The community supplied the Michirata images and variants; the concept art was generated with AI. The original animated WebP files have been preserved. See [public/assets/README.md](public/assets/README.md) for details.
