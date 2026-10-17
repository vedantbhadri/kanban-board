# Kanban Project

## Product

- One Kanban board with five fixed, renameable columns and seeded cards.
- Cards have a title and details only. Users can add, delete, reorder within a column, and drag between columns.
- Keep one add button in each column header.
- No persistence, accounts, archive, search, or filters.
- Prioritize a polished, simple interface. Keep the workspace sidebar, user profile, and live status display out of the UI.

## Implementation

- The client-rendered Next.js app lives in `frontend`.
- Use current, popular libraries and idiomatic approaches.
- Keep the code simple. Avoid extra features and unnecessary defensive code.

## Color scheme

- Accent yellow: `#ecad0a`
- Primary blue: `#209dd7`
- Secondary purple: `#753991`
- Dark navy: `#032147`
- Gray text: `#888888`

## Verification

- Unit test board state changes and cover core workflows with Playwright.
- Run lint, type checking, and the production build after code changes.

## Writing

- Be concise. Keep the README minimal. Do not use emojis.
