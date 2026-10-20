import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException


SEED_COLUMNS = [
    ("ideas", "Ideas"),
    ("todo", "To do"),
    ("progress", "In progress"),
    ("review", "Review"),
    ("done", "Done"),
]
SEED_CARDS = [
    ("c1", "ideas", "Explore visual direction", "Gather references and define a clear feel for the product."),
    ("c2", "ideas", "Map user journey", "Sketch the key moments from first visit to completion."),
    ("c3", "todo", "Write landing page copy", "Draft a concise headline and supporting sections."),
    ("c4", "todo", "Prepare design assets", "Collect illustrations, icons, and product screenshots."),
    ("c5", "progress", "Build component library", "Create reusable foundations for the interface."),
    ("c6", "progress", "Design dashboard", "Refine the overview and primary navigation."),
    ("c7", "review", "Review onboarding flow", "Check clarity, pacing, and empty states."),
    ("c8", "done", "Define project goals", "Align on scope and the outcomes that matter."),
]


def database_path() -> Path:
    return Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parent.parent / "kanban.db"))


@contextmanager
def connection():
    db = sqlite3.connect(database_path())
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize():
    database_path().parent.mkdir(parents=True, exist_ok=True)
    with connection() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS boards (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS columns (
                board_id TEXT NOT NULL REFERENCES boards(id),
                id TEXT NOT NULL,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                PRIMARY KEY (board_id, id),
                UNIQUE (board_id, position)
            );
            CREATE TABLE IF NOT EXISTS cards (
                board_id TEXT NOT NULL REFERENCES boards(id),
                id TEXT NOT NULL,
                column_id TEXT NOT NULL,
                title TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                position INTEGER NOT NULL,
                PRIMARY KEY (board_id, id),
                FOREIGN KEY (board_id, column_id) REFERENCES columns(board_id, id)
            );
            CREATE INDEX IF NOT EXISTS cards_by_column ON cards(board_id, column_id, position);
        """)
        db.execute("PRAGMA user_version = 1")
        if db.execute("SELECT 1 FROM users WHERE id = 'demo'").fetchone():
            return
        db.execute("INSERT INTO users (id, username) VALUES ('demo', 'user')")
        db.execute("INSERT INTO boards (id, user_id) VALUES ('demo-board', 'demo')")
        for position, (column_id, title) in enumerate(SEED_COLUMNS):
            db.execute("INSERT INTO columns VALUES (?, ?, ?, ?)", ("demo-board", column_id, title, position))
        positions: dict[str, int] = {}
        for card_id, column_id, title, details in SEED_CARDS:
            position = positions.get(column_id, 0)
            db.execute("INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?)", ("demo-board", card_id, column_id, title, details, position))
            positions[column_id] = position + 1


def board_id_for_user(db: sqlite3.Connection, user_id: str) -> str:
    row = db.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Board not found")
    return row["id"]


def read_board(db: sqlite3.Connection, board_id: str) -> dict:
    columns = db.execute("SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)).fetchall()
    cards = db.execute("SELECT id, column_id, title, details FROM cards WHERE board_id = ? ORDER BY column_id, position", (board_id,)).fetchall()
    return {
        "columns": [dict(row) for row in columns],
        "cards": [{"id": row["id"], "columnId": row["column_id"], "title": row["title"], "details": row["details"]} for row in cards],
    }


def require_column(db: sqlite3.Connection, board_id: str, column_id: str):
    if not db.execute("SELECT 1 FROM columns WHERE board_id = ? AND id = ?", (board_id, column_id)).fetchone():
        raise HTTPException(404, "Column not found")


def require_card(db: sqlite3.Connection, board_id: str, card_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM cards WHERE board_id = ? AND id = ?", (board_id, card_id)).fetchone()
    if not row:
        raise HTTPException(404, "Card not found")
    return row


def rename_column(db: sqlite3.Connection, board_id: str, column_id: str, title: str):
    require_column(db, board_id, column_id)
    db.execute("UPDATE columns SET title = ? WHERE board_id = ? AND id = ?", (title.strip(), board_id, column_id))


def create_card(db: sqlite3.Connection, board_id: str, column_id: str, title: str, details: str) -> str:
    require_column(db, board_id, column_id)
    position = db.execute("SELECT COUNT(*) FROM cards WHERE board_id = ? AND column_id = ?", (board_id, column_id)).fetchone()[0]
    card_id = str(uuid4())
    db.execute("INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?)", (board_id, card_id, column_id, title.strip(), details.strip(), position))
    return card_id


def edit_card(db: sqlite3.Connection, board_id: str, card_id: str, title: str, details: str):
    require_card(db, board_id, card_id)
    db.execute("UPDATE cards SET title = ?, details = ? WHERE board_id = ? AND id = ?", (title.strip(), details.strip(), board_id, card_id))


def reorder(db: sqlite3.Connection, board_id: str, column_id: str, card_ids: list[str]):
    for position, card_id in enumerate(card_ids):
        db.execute("UPDATE cards SET column_id = ?, position = ? WHERE board_id = ? AND id = ?", (column_id, position, board_id, card_id))


def delete_card(db: sqlite3.Connection, board_id: str, card_id: str):
    column_id = require_card(db, board_id, card_id)["column_id"]
    db.execute("DELETE FROM cards WHERE board_id = ? AND id = ?", (board_id, card_id))
    remaining = [row["id"] for row in db.execute("SELECT id FROM cards WHERE board_id = ? AND column_id = ? ORDER BY position", (board_id, column_id))]
    reorder(db, board_id, column_id, remaining)


def move_card(db: sqlite3.Connection, board_id: str, card_id: str, column_id: str, target_card_id: str | None):
    moving = require_card(db, board_id, card_id)
    require_column(db, board_id, column_id)
    source_id = moving["column_id"]
    if target_card_id == card_id:
        return
    source = [row["id"] for row in db.execute("SELECT id FROM cards WHERE board_id = ? AND column_id = ? ORDER BY position", (board_id, source_id))]
    destination = source if source_id == column_id else [row["id"] for row in db.execute("SELECT id FROM cards WHERE board_id = ? AND column_id = ? ORDER BY position", (board_id, column_id))]
    moving_down = source_id == column_id and target_card_id in source and source.index(card_id) < source.index(target_card_id)
    source.remove(card_id)
    if target_card_id:
        if target_card_id not in destination:
            raise HTTPException(400, "Target card is not in the destination column")
        index = destination.index(target_card_id) + int(moving_down)
    else:
        index = len(destination)
    destination.insert(index, card_id)
    reorder(db, board_id, source_id, source)
    if source_id != column_id:
        reorder(db, board_id, column_id, destination)
