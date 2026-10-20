import asyncio
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend import ai, db
from backend.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "board.db"))
    with TestClient(app) as browser:
        yield browser


def sign_in(client):
    assert client.post("/api/login", json={"username": "user", "password": "password"}).status_code == 200


def test_health_and_auth(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/").status_code == 200
    assert client.get("/api/session").json() == {"authenticated": False}
    assert client.get("/api/board").status_code == 401
    assert client.post("/api/cards", json={"columnId": "ideas", "title": "Nope"}).status_code == 401
    assert client.post("/api/login", json={"username": "user", "password": "wrong"}).status_code == 401
    sign_in(client)
    assert client.get("/api/session").json() == {"authenticated": True}
    assert len(client.get("/api/board").json()["cards"]) == 8
    client.post("/api/logout")
    assert client.get("/api/board").status_code == 401


def test_board_crud_and_persistence(client):
    sign_in(client)
    board = client.get("/api/board").json()
    assert [column["id"] for column in board["columns"]] == ["ideas", "todo", "progress", "review", "done"]
    assert client.patch("/api/columns/ideas", json={"title": "Discovery"}).json()["columns"][0]["title"] == "Discovery"
    board = client.post("/api/cards", json={"columnId": "ideas", "title": "New task", "details": "Some details"}).json()
    card_id = next(card["id"] for card in board["cards"] if card["title"] == "New task")
    board = client.patch(f"/api/cards/{card_id}", json={"title": "Edited task", "details": "Updated"}).json()
    assert next(card for card in board["cards"] if card["id"] == card_id)["details"] == "Updated"
    board = client.post(f"/api/cards/{card_id}/move", json={"columnId": "done"}).json()
    assert next(card for card in board["cards"] if card["id"] == card_id)["columnId"] == "done"
    assert len(client.get("/api/board").json()["cards"]) == 9
    assert len(client.delete(f"/api/cards/{card_id}").json()["cards"]) == 8
    with db.connection() as conn:
        assert db.read_board(conn, "demo-board")["columns"][0]["title"] == "Discovery"
    with TestClient(app) as restarted:
        sign_in(restarted)
        assert restarted.get("/api/board").json()["columns"][0]["title"] == "Discovery"


def test_reorder_and_invalid_targets_roll_back(client):
    sign_in(client)
    moved = client.post("/api/cards/c1/move", json={"columnId": "ideas", "targetCardId": "c2"}).json()
    assert [card["id"] for card in moved["cards"] if card["columnId"] == "ideas"] == ["c2", "c1"]
    moved = client.post("/api/cards/c1/move", json={"columnId": "ideas", "targetCardId": "c2"}).json()
    assert [card["id"] for card in moved["cards"] if card["columnId"] == "ideas"] == ["c1", "c2"]
    before = client.get("/api/board").json()
    assert client.post("/api/cards/c1/move", json={"columnId": "done", "targetCardId": "c2"}).status_code == 400
    assert client.patch("/api/cards/c1", json={"title": "  ", "details": "x"}).status_code == 422
    assert client.post("/api/cards", json={"columnId": "missing", "title": "Nope"}).status_code == 404
    assert client.get("/api/board").json() == before


def test_schema_scopes_seed_ids_to_board(client):
    with db.connection() as conn:
        conn.execute("INSERT INTO users VALUES ('other', 'another-user')")
        conn.execute("INSERT INTO boards VALUES ('other-board', 'other')")
        conn.execute("INSERT INTO columns VALUES ('other-board', 'ideas', 'Ideas', 0)")
        conn.execute("INSERT INTO cards VALUES ('other-board', 'c1', 'ideas', 'Private', '', 0)")
        assert db.board_id_for_user(conn, "other") == "other-board"
        assert db.read_board(conn, "other-board")["cards"][0]["title"] == "Private"
        assert db.read_board(conn, "demo-board")["cards"][0]["title"] != "Private"


def test_chat_applies_multiple_actions_atomically(client, monkeypatch):
    assert client.post("/api/chat", json={"message": "Move a card"}).status_code == 401
    sign_in(client)
    captured = {}

    async def fake_generate(board, message, history):
        captured.update(board=board, message=message, history=history)
        return ai.ChatOutput(response="Done.", actions=[
            ai.Action(type="create", cardId="", columnId="todo", title="New task", details="From chat", targetCardId=""),
            ai.Action(type="edit", cardId="c1", columnId="", title="New direction", details="Updated by AI", targetCardId=""),
            ai.Action(type="move", cardId="c2", columnId="done", title="", details="", targetCardId=""),
        ])

    monkeypatch.setattr("backend.main.ai.generate", fake_generate)
    result = client.post("/api/chat", json={"message": "Update these cards", "history": [{"role": "user", "content": "Earlier"}]}).json()
    assert result["actionsApplied"] == 3
    assert result["response"] == "Done."
    assert captured["message"] == "Update these cards"
    assert captured["history"] == [{"role": "user", "content": "Earlier"}]
    assert len(captured["board"]["cards"]) == 8
    cards = {card["id"]: card for card in result["board"]["cards"]}
    assert cards["c1"]["title"] == "New direction"
    assert cards["c2"]["columnId"] == "done"
    assert any(card["title"] == "New task" for card in cards.values())

    before = client.get("/api/board").json()

    async def invalid_generate(*_args):
        return ai.ChatOutput(response="Done.", actions=[
            ai.Action(type="create", cardId="", columnId="ideas", title="Should roll back", details="", targetCardId=""),
            ai.Action(type="move", cardId="missing", columnId="done", title="", details="", targetCardId=""),
        ])

    monkeypatch.setattr("backend.main.ai.generate", invalid_generate)
    assert client.post("/api/chat", json={"message": "Bad update"}).status_code == 404
    assert client.get("/api/board").json() == before


def test_chat_provider_error_leaves_board_unchanged(client, monkeypatch):
    sign_in(client)
    before = client.get("/api/board").json()

    async def failing_generate(*_args):
        raise HTTPException(502, "AI response failed. Please try again.")

    monkeypatch.setattr("backend.main.ai.generate", failing_generate)
    assert client.post("/api/chat", json={"message": "Help"}).status_code == 502
    assert client.get("/api/board").json() == before


def test_missing_openrouter_key_returns_clear_error(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(HTTPException) as error:
        asyncio.run(ai.generate({"columns": [], "cards": []}, "Hello", []))
    assert error.value.status_code == 503
