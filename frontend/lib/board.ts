export type Card = { id: string; title: string; details: string; columnId: string };
export type Column = { id: string; title: string };
export type BoardState = { columns: Column[]; cards: Card[] };

export const initialBoard: BoardState = {
  columns: [
    { id: "ideas", title: "Ideas" },
    { id: "todo", title: "To do" },
    { id: "progress", title: "In progress" },
    { id: "review", title: "Review" },
    { id: "done", title: "Done" },
  ],
  cards: [
    { id: "c1", columnId: "ideas", title: "Explore visual direction", details: "Gather references and define a clear feel for the product." },
    { id: "c2", columnId: "ideas", title: "Map user journey", details: "Sketch the key moments from first visit to completion." },
    { id: "c3", columnId: "todo", title: "Write landing page copy", details: "Draft a concise headline and supporting sections." },
    { id: "c4", columnId: "todo", title: "Prepare design assets", details: "Collect illustrations, icons, and product screenshots." },
    { id: "c5", columnId: "progress", title: "Build component library", details: "Create reusable foundations for the interface." },
    { id: "c6", columnId: "progress", title: "Design dashboard", details: "Refine the overview and primary navigation." },
    { id: "c7", columnId: "review", title: "Review onboarding flow", details: "Check clarity, pacing, and empty states." },
    { id: "c8", columnId: "done", title: "Define project goals", details: "Align on scope and the outcomes that matter." },
  ],
};

export type BoardAction =
  | { type: "rename"; columnId: string; title: string }
  | { type: "add"; card: Card }
  | { type: "delete"; cardId: string }
  | { type: "move"; cardId: string; columnId: string; targetCardId?: string };

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "rename": {
      const title = action.title.trim();
      if (!title) return state;
      return { ...state, columns: state.columns.map((column) => column.id === action.columnId ? { ...column, title } : column) };
    }
    case "add":
      if (!action.card.title.trim() || !state.columns.some((column) => column.id === action.card.columnId)) return state;
      return { ...state, cards: [...state.cards, { ...action.card, title: action.card.title.trim(), details: action.card.details.trim() }] };
    case "delete":
      return { ...state, cards: state.cards.filter((card) => card.id !== action.cardId) };
    case "move": {
      if (!state.columns.some((column) => column.id === action.columnId)) return state;
      const moving = state.cards.find((card) => card.id === action.cardId);
      if (!moving || action.targetCardId === action.cardId) return state;
      const remaining = state.cards.filter((card) => card.id !== action.cardId);
      const targetIndex = action.targetCardId ? remaining.findIndex((card) => card.id === action.targetCardId && card.columnId === action.columnId) : -1;
      const lastInColumn = remaining.findLastIndex((card) => card.columnId === action.columnId);
      const movingDown = moving.columnId === action.columnId && state.cards.findIndex((card) => card.id === action.cardId) < state.cards.findIndex((card) => card.id === action.targetCardId);
      const index = targetIndex >= 0 ? targetIndex + Number(movingDown) : lastInColumn >= 0 ? lastInColumn + 1 : remaining.length;
      return { ...state, cards: [...remaining.slice(0, index), { ...moving, columnId: action.columnId }, ...remaining.slice(index)] };
    }
  }
}
