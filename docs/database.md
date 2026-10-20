# Database approach

The schema is in [`schema.json`](schema.json). SQLite keeps one board per user through `boards.user_id UNIQUE`. Column and card IDs are scoped to a board, so different users can start with the same demo IDs. The five columns are created with each board and can be renamed, but not added, removed, or reordered.

Cards are read by column and `position`. Moves and reorders update affected positions in one transaction. The API checks ownership through the signed-in user before every read or write and validates that a target column belongs to that user's board. AI actions use the same validation and one transaction for all actions in a response.

On startup, the backend enables SQLite foreign keys, creates missing tables, and seeds the `user` account with one board only if it does not exist. The hardcoded MVP password is checked by the login endpoint and is not stored in SQLite. A later authentication system can add password hashes without changing board ownership. This initial schema is recorded as version 1 with SQLite `PRAGMA user_version`.

The database file lives at `DATABASE_PATH`, mounted to a Docker volume so stopping or rebuilding the container does not erase cards.
