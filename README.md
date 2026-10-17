# Kanban Board

A simple, single-board Kanban app for organizing work from ideas to completion. It opens with sample cards so you can try it immediately.

## Features

- Five fixed columns that you can rename.
- Add cards with a title and optional details, or delete them.
- Drag cards to reorder them within a column or move them between columns.
- See card counts for each column and the board.

Board state is held in browser memory. Changes reset when you refresh the page; there are no accounts or saved data.

## Run locally

Install a current Node.js LTS release and npm, then run:

```sh
cd frontend
npm ci
npm run dev
```

For a production build, run `npm run build` followed by `npm run start` from `frontend`.

## Checks

From `frontend`, run:

```sh
npm run lint
npm run typecheck
npm run test
npx playwright install
npm run test:e2e
```

## Stack

Next.js, React, TypeScript, dnd-kit, Vitest, and Playwright. The app lives in [`frontend`](frontend/).
