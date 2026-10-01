# Chess Evolved · v1.0.0

A two-player chess game for GitHub Pages, using PeerJS data channels and chess.js for classic rules. No application backend, account or subscription is required. The default public PeerJS signaling service is used to introduce the browsers; GitHub Pages serves the game files.

## Publish without installing anything

The release ZIP contains two folders:

- **github-pages/** — the finished, bundled game, ready to upload.
- **source/** — editable project, tests, dependencies lockfile and optional GitHub Actions deployment.

1. Create a GitHub repository (for example `Chess_Evolved`).
2. Upload **the contents of `github-pages/`** to the repository root. `index.html` and `assets/` must be directly at the root. Do not upload the parent release folder.
3. Commit the upload to `main`.
4. In **Settings → Pages**, select **Deploy from a branch**, `main`, and **/ (root)**. Save.
5. Open the HTTPS address shown by GitHub when deployment finishes.

A typical address is `https://YOUR-USERNAME.github.io/Chess_Evolved/`. Relative asset paths support repository subpaths. Opening `index.html` by double-clicking it is not supported; use GitHub Pages or a local HTTP server.

Alternatively, upload/push the contents of `source/` to a repository, including `.github/workflows/pages.yml`, and choose **GitHub Actions** in Settings → Pages. The workflow installs, tests, builds and deploys the game on pushes to `main`. GitHub's browser file picker may omit dotfolders; use Git to include the workflow.

## Play

- Same device: White and Black alternate on one board.
- Online: select Online and Create a room. The host is White.
- Share the eight-character code or Copy invite. Your friend opens the same game, enters the code and clicks Join. The guest is Black; invite links prefill the code.
- Click a piece, then a highlighted destination. A pawn reaching the last rank offers Queen, Rook, Bishop or Knight.
- The board automatically faces the guest; either player can flip it.
- Offer/accept/decline draws, resign or agree to a rematch. Colors stay the same for rematches.
- Export PGN downloads the game notation.
- Keyboard: Tab to a square, arrow keys to navigate, Enter/Space to select, Escape to clear selection.

## Connection limits

Both tabs must stay open. A disconnected guest can use **Reconnect** in the same tab to restore the complete game from the host. The guest seat stays reserved, so a third player cannot replace them. Reloading either page resets that tab's room identity; host refresh/closure ends the room. There is no persistent save, lobby, matchmaking, spectator mode, AI or clock in v1.

WebRTC depends on the public signaling service and the players' networks. Firewalls or restrictive school/work networks may block direct connections. This build does not provision a dedicated TURN relay and cannot guarantee connectivity on every network. A production release can configure a private PeerServer and TURN credentials in the transport layer.

The host is authoritative: it validates the guest's legal actions, side, game ID and revision. The guest reconstructs and checks each received position from move history. This is suitable for casual games between friends, not cheat-resistant ranked play against a malicious host.

Classic rules include castling, en passant, promotion, king safety, checkmate, stalemate and insufficient material. For casual play, the game automatically draws on threefold repetition and the 50-move condition instead of requiring a formal claim. No tournament clocks or FIDE fivefold/75-move adjudication are implemented.

## Develop

Use Node.js 22.12+ or a recent Node.js 24 release.

```sh
npm ci
npm run dev
```

Then open the local address printed by Vite. Two browser tabs can be used to play online via the public signaling service.

```sh
npm test
npm run build
npm run preview
```

Browser checks (requires a working browser download and internet access for the live PeerJS test):

```sh
npx playwright install chromium
npm run test:browser
```

## Custom pieces and abilities later

The files deliberately separate responsibilities:

| File | Responsibility |
| --- | --- |
| `src/rules.js` | Classic legality, board queries, piece definitions and position replay |
| `src/session.js` | Action validation, turn ownership, results, draw/rematch consent and versioned snapshots |
| `src/network.js` | PeerJS rooms, seat identity, data-channel handshake and recovery |
| `src/main.js` | Board rendering, room controls, promotion and move history |
| `src/style.css` | Responsive visual presentation |

Moves are actions (`{ type: 'move', from, to, promotion }`), rather than direct DOM changes. Snapshots include a ruleset ID/version and transport protocol version; different versions are rejected.

`ClassicRules` is the adapter boundary for a future variant. A custom adapter will need equivalent board/turn queries, legal actions, authoritative apply, replay/serialization and result handling. chess.js enforces standard pieces and **cannot simply be given arbitrary new pieces or ability movement**. Replace the classic adapter with a dedicated variant engine when implementing those. Update the session factory, piece registry, renderer/history notation and protocol version as needed. Abilities should use validated actions (for example `{ type: 'ability', pieceId, abilityId, target }`), with host validation and deterministic serialized cooldowns/effects. No speculative abilities are shipped now.

## Validation of this release

- 11 automated rules, transport and DOM interaction tests pass.
- Production build passes; libraries are bundled locally.
- DOM interaction checks exercise legal highlights, alternating turns, checkmate, board flip, local restart, draw consent and invalid room input.
- Transport tests cover two-player handshake, synchronization, stale messages, guest recovery and third-player rejection using an in-memory PeerJS double.
- Browser/local visual tests and the live public PeerJS test are included but could not run in the build environment because the Chromium download was blocked. Actual two-device internet connectivity and visual browser QA remain unverified.

Third-party licenses are in `THIRD_PARTY_NOTICES.txt`. Optional Google Fonts have system-font fallbacks.
