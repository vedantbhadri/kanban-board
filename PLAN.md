# Project plan

The existing `frontend/` is the starting point. Keep its board design and five columns. The finished app runs from one Docker container: FastAPI serves the exported Next.js site, API, and a SQLite database. AI card actions apply immediately, as agreed with the user.

## Part 1: Plan and review

- [x] Inspect the current frontend, repository, and requirements.
- [x] Expand this plan with checks and success criteria for every phase.
- [x] Document the existing frontend in `frontend/AGENTS.md`.
- [x] User reviews and approves this plan before implementation.

Success: the implementation path and its approval points are explicit.

## Part 2: Scaffolding

- [x] Add `backend/` FastAPI app, `pyproject.toml`, uv lockfile, Dockerfile, compose file, `.dockerignore`, and cross-platform start/stop scripts.
- [x] Serve a temporary HTML page at `/` and a JSON health endpoint at `/api/health`.
- [ ] Test both endpoints from the running container (Docker is unavailable on this machine).

Success: one command starts the container; HTML and API responses work; stop script stops it.

## Part 3: Static frontend

- [x] Export the existing Next.js app to `frontend/out` and serve it from FastAPI at `/`, including its assets.
- [x] Preserve the current board appearance, drag and drop, column renaming, and card controls.
- [ ] Run frontend unit tests, lint, type checking, production build, and browser smoke tests against the container (local FastAPI checks passed; Docker check remains).

Success: the seeded board works at `/` through FastAPI, with no Next.js server in the final container.

## Part 4: Sign in

- [x] Add a sign-in screen and sign-out action using `user` / `password`.
- [x] Validate credentials on the backend and use a server-managed session cookie to protect board and chat APIs.
- [x] Test invalid credentials, sign in, refresh, sign out, and unauthenticated API access.

Success: only a signed-in browser can see or change board data.

## Part 5: Database design and review

- [x] Propose the SQLite schema as JSON in `docs/schema.json` and document ownership, ordering, initialization, and migrations in `docs/database.md`.
- [x] Get user sign-off on the schema before building the persistence routes.

Success: the schema supports multiple users, one board per user, five ordered columns, and ordered cards; the user approves it.

## Part 6: Backend board API

- [x] Initialize SQLite on startup, create the demo user and seeded board only when absent.
- [x] Add authenticated board read, column rename, and card create, edit, delete, and move endpoints.
- [x] Test validation, user isolation, ordering, persistence across restart, and malformed requests with backend unit/integration tests.

Success: all board changes persist and belong to the signed-in user.

## Part 7: Frontend and backend integration

- [x] Replace local-only board state with API loading and mutations; add an edit-card control.
- [x] Show loading and actionable errors without changing the simple board workflow.
- [x] Exercise sign in, every board mutation, refresh, and sign out in browser tests; verify restart persistence in backend integration tests.

Success: the browser and database stay in sync, including after a container restart.

## Part 8: AI connectivity

- [x] Read `OPENROUTER_API_KEY` only on the backend and call `openai/gpt-oss-120b` through OpenRouter.
- [x] Verify a `2+2` response through the backend with the real key; test missing-key and provider-error handling separately.

Success: the model returns a valid answer, and the key never reaches browser assets or Git.

## Part 9: Structured AI board actions

- [x] Send the current board JSON, user message, and conversation history to the model.
- [x] Require a structured reply containing assistant text and optional card create, edit, or move actions.
- [x] Validate action IDs and fields, then apply all valid actions atomically to the signed-in user's board.
- [x] Test multiple actions, invalid targets, provider errors, and rollback with a mocked provider.

Success: AI responses can change one or more cards immediately without corrupting board state.

## Part 10: AI chat UI and final verification

- [x] Add a polished chat sidebar that sends messages, shows conversation history and errors, and refreshes the board after AI actions.
- [ ] Test chat-only and board-changing requests end to end; rerun backend tests, frontend checks, browser tests, and Docker build/start/stop checks (all local checks passed; Docker remains unavailable).
- [x] Update the concise README and leave the app running locally for review.

Success: the whole app works in one container, including sign in, persistent board editing, and AI card changes.
