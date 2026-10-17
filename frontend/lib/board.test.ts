import { describe, expect, it } from "vitest";
import { boardReducer, initialBoard } from "./board";

const titlesIn = (state: typeof initialBoard, columnId: string) => state.cards.filter((card) => card.columnId === columnId).map((card) => card.title);

describe("boardReducer", () => {
  it("starts with one seeded board of five columns", () => {
    expect(initialBoard.columns).toHaveLength(5);
    expect(initialBoard.cards).toHaveLength(8);
  });

  it("renames a column without changing its identity or cards", () => {
    const next = boardReducer(initialBoard, { type: "rename", columnId: "ideas", title: "  Discovery  " });
    expect(next.columns[0]).toEqual({ id: "ideas", title: "Discovery" });
    expect(next.cards).toEqual(initialBoard.cards);
    expect(boardReducer(initialBoard, { type: "rename", columnId: "ideas", title: " " })).toBe(initialBoard);
  });

  it("adds a trimmed card to the chosen column", () => {
    const next = boardReducer(initialBoard, { type: "add", card: { id: "new", columnId: "review", title: "  Check flow  ", details: "  Review copy  " } });
    expect(next.cards.at(-1)).toEqual({ id: "new", columnId: "review", title: "Check flow", details: "Review copy" });
  });

  it("rejects an empty title or unknown column", () => {
    expect(boardReducer(initialBoard, { type: "add", card: { id: "new", columnId: "review", title: " ", details: "" } })).toBe(initialBoard);
    expect(boardReducer(initialBoard, { type: "add", card: { id: "new", columnId: "other", title: "Task", details: "" } })).toBe(initialBoard);
  });

  it("moves a card to another column", () => {
    const next = boardReducer(initialBoard, { type: "move", cardId: "c1", columnId: "done" });
    expect(titlesIn(next, "done")).toEqual(["Define project goals", "Explore visual direction"]);
    expect(titlesIn(next, "ideas")).toEqual(["Map user journey"]);
  });

  it("reorders cards in the same column in both directions", () => {
    const down = boardReducer(initialBoard, { type: "move", cardId: "c1", columnId: "ideas", targetCardId: "c2" });
    expect(titlesIn(down, "ideas")).toEqual(["Map user journey", "Explore visual direction"]);
    const up = boardReducer(initialBoard, { type: "move", cardId: "c2", columnId: "ideas", targetCardId: "c1" });
    expect(titlesIn(up, "ideas")).toEqual(["Map user journey", "Explore visual direction"]);
  });

  it("places a moved card before a card in another column", () => {
    const next = boardReducer(initialBoard, { type: "move", cardId: "c1", columnId: "todo", targetCardId: "c4" });
    expect(titlesIn(next, "todo")).toEqual(["Write landing page copy", "Explore visual direction", "Prepare design assets"]);
  });

  it("ignores invalid move targets", () => {
    expect(boardReducer(initialBoard, { type: "move", cardId: "c1", columnId: "other" })).toBe(initialBoard);
    expect(boardReducer(initialBoard, { type: "move", cardId: "missing", columnId: "ideas" })).toBe(initialBoard);
    expect(boardReducer(initialBoard, { type: "move", cardId: "c1", columnId: "ideas", targetCardId: "c1" })).toBe(initialBoard);
  });

  it("deletes only the requested card", () => {
    const next = boardReducer(initialBoard, { type: "delete", cardId: "c1" });
    expect(next.cards).toHaveLength(7);
    expect(next.cards.some((card) => card.id === "c1")).toBe(false);
    expect(next.cards.some((card) => card.id === "c2")).toBe(true);
  });
});
