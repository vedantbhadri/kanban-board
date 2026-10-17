# MVP plan

## 1. Scaffold
- [x] Create `frontend` as a current Next.js TypeScript app with a root `.gitignore` and minimal README.
- [x] Install the board UI, drag and drop, unit test, and browser test dependencies.
- [x] Verify the app starts locally.

## 2. Board
- [x] Show one seeded board with exactly five columns.
- [x] Rename any column, add a card with title and details, delete a card, and drag a card to another column.
- [x] Keep state in memory only, with no unrelated product features.
- [x] Deliver a polished desktop and mobile interface using the specified palette.

## 3. Verification
- [x] Unit test board state changes and edge cases.
- [x] Run browser tests for the main workflows and responsive layout.
- [x] Run lint, type checking, and production build; fix any defects.
- [x] Leave the app server running for review.

## 4. Refinements
- [x] Reorder cards within a column and verify both drag directions in browser tests.
- [x] Keep one add button per column and remove the redundant workspace sidebar, profile, and top status items.
- [x] Recheck responsive layout, unit tests, lint, production build, and running server.
