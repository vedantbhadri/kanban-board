# Kanban Board

A single-board Kanban app with persistent cards, sign-in, and an AI assistant that can create, edit, and move cards from chat. It starts with sample cards.

This project was built with AI assistance using a vibe coding approach.

## Features

- Five fixed columns that you can rename.
- Add, edit, or delete cards with a title and optional details.
- Drag cards to reorder them within a column or move them between columns.
- Ask the assistant about the board or tell it to change multiple cards. Changes apply immediately.

Cards and columns are saved in SQLite. Chat history lasts for the current page session.

## Run locally

Install Docker and create a `.env` file in the repository root with your OpenRouter key:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key
```

Then run:

```sh
./scripts/start.sh
```

On Windows, run `scripts\start.bat`. Sign in with `user` / `password`. Stop with `./scripts/stop.sh` or `scripts\stop.bat`. The database stays in a Docker volume.

## Checks

For local checks, install Python 3.13, uv, Node.js 24, and npm. Run these from the repository root:

```sh
uv sync
uv run python -m pytest
cd frontend
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install
npm run test:e2e
```

## Stack

Static Next.js and React frontend, FastAPI backend, SQLite, OpenRouter (`openai/gpt-oss-120b`), Docker, Vitest, and Playwright.
