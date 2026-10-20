# Frontend

This is the client-rendered Next.js App Router frontend. `app/page.tsx` handles sign-in, session checking, and sign-out. `components/board.tsx` loads and changes the board through the FastAPI routes, and `components/chat-sidebar.tsx` sends chat requests and updates the board from their responses. CSS in `app/` holds the visual design. `lib/board.ts` defines the board types and the original pure state transitions; `lib/board.test.ts` tests those transitions. `tests/board.spec.ts` exercises the served app with Playwright. Package scripts are in `package.json`.

The board persists through the backend, while chat history stays in browser memory. `next.config.ts` exports a static site served by FastAPI. Keep API requests same-origin and do not add Next.js server-only features.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
