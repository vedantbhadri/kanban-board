import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from backend import ai, db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.initialize()
    yield


app = FastAPI(title="Kanban Board", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET") or secrets.token_urlsafe(32),
    same_site="lax",
    https_only=False,
)


class Credentials(BaseModel):
    username: str
    password: str


class ColumnUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=32)


class CardInput(BaseModel):
    columnId: str
    title: str = Field(min_length=1, max_length=100)
    details: str = Field(default="", max_length=2000)


class CardUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    details: str = Field(default="", max_length=2000)


class CardMove(BaseModel):
    columnId: str
    targetCardId: str | None = None


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


def current_user(request: Request) -> str:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Sign in required")
    return user_id


def clean_title(title: str) -> str:
    if not title.strip():
        raise HTTPException(422, "Title is required")
    return title.strip()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/session")
def session(request: Request):
    return {"authenticated": request.session.get("user_id") == "demo"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if credentials.username == "user" and credentials.password == "password":
        request.session["user_id"] = "demo"
        return {"authenticated": True}
    raise HTTPException(status_code=401, detail="Invalid username or password")


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"authenticated": False}


@app.get("/api/board")
def get_board(user_id: str = Depends(current_user)):
    with db.connection() as conn:
        return db.read_board(conn, db.board_id_for_user(conn, user_id))


@app.patch("/api/columns/{column_id}")
def update_column(column_id: str, update: ColumnUpdate, user_id: str = Depends(current_user)):
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        db.rename_column(conn, board_id, column_id, clean_title(update.title))
        return db.read_board(conn, board_id)


@app.post("/api/cards")
def add_card(card: CardInput, user_id: str = Depends(current_user)):
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        db.create_card(conn, board_id, card.columnId, clean_title(card.title), card.details)
        return db.read_board(conn, board_id)


@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, card: CardUpdate, user_id: str = Depends(current_user)):
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        db.edit_card(conn, board_id, card_id, clean_title(card.title), card.details)
        return db.read_board(conn, board_id)


@app.delete("/api/cards/{card_id}")
def remove_card(card_id: str, user_id: str = Depends(current_user)):
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        db.delete_card(conn, board_id, card_id)
        return db.read_board(conn, board_id)


@app.post("/api/cards/{card_id}/move")
def move_card(card_id: str, move: CardMove, user_id: str = Depends(current_user)):
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        db.move_card(conn, board_id, card_id, move.columnId, move.targetCardId)
        return db.read_board(conn, board_id)


@app.post("/api/chat")
async def chat(request: ChatRequest, user_id: str = Depends(current_user)):
    history = [entry.model_dump() for entry in request.history if entry.role in {"user", "assistant"}]
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        current_board = db.read_board(conn, board_id)
    reply = await ai.generate(current_board, request.message.strip(), history)
    with db.connection() as conn:
        board_id = db.board_id_for_user(conn, user_id)
        if db.read_board(conn, board_id) != current_board:
            raise HTTPException(409, "Board changed while AI was responding. Please retry.")
        for action in reply.actions:
            if action.type == "create":
                db.create_card(conn, board_id, action.columnId, clean_title(action.title), action.details)
            elif action.type == "edit":
                db.edit_card(conn, board_id, action.cardId, clean_title(action.title), action.details)
            else:
                db.move_card(conn, board_id, action.cardId, action.columnId, action.targetCardId or None)
        return {"response": reply.response, "actionsApplied": len(reply.actions), "board": db.read_board(conn, board_id)}


static_dir = Path(__file__).resolve().parent.parent / "frontend" / "out"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def placeholder():
        return "<h1>Kanban Board</h1><p>Frontend build is not installed yet.</p>"
