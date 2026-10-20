"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { ArrowUpRight, Check, GripVertical, LayoutGrid, LogOut, Pencil, Plus, X } from "lucide-react";
import { type BoardState, type Card, type Column } from "@/lib/board";
import ChatSidebar from "@/components/chat-sidebar";

const columnColors = ["yellow", "blue", "purple", "peach", "green"];

const cardFirstCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args).filter((hit) => hit.id !== `card:${args.active.id}`);
  const cardHits = hits.filter((hit) => String(hit.id).startsWith("card:"));
  return cardHits.length ? cardHits : hits.length ? hits : rectIntersection(args);
};

function TaskCard({ card, onDelete, onEdit, overlay = false }: { card: Card; onDelete?: (id: string) => void; onEdit?: (card: Card) => void; overlay?: boolean }) {
  return (
    <article className={`task-card${overlay ? " task-card-overlay" : ""}`} aria-label={card.title}>
      <div className="task-card-top">
        <span className="task-mark" aria-hidden="true" />
        {onDelete && <div className="card-actions"><button className="card-edit" type="button" aria-label={`Edit ${card.title}`} title="Edit card" onClick={() => onEdit?.(card)}><Pencil size={14} /></button><button className="card-delete" type="button" aria-label={`Delete ${card.title}`} title="Delete card" onClick={() => onDelete(card.id)}><X size={15} strokeWidth={2} /></button></div>}
      </div>
      <h3>{card.title}</h3>
      {card.details && <p>{card.details}</p>}
      <div className="task-card-footer"><span>Task</span><GripVertical size={16} aria-hidden="true" /></div>
    </article>
  );
}

function DraggableCard({ card, onDelete, onEdit, dropAfter }: { card: Card; onDelete: (id: string) => void; onEdit: (card: Card) => void; dropAfter: boolean }) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: card.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `card:${card.id}` });
  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={`draggable${isDragging ? " is-dragging" : ""}${isOver && !isDragging ? ` card-drop-target${dropAfter ? " drop-after" : ""}` : ""}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...listeners}
      {...attributes}
    >
      <TaskCard card={card} onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}

function BoardColumn({ column, index, cards, activeCardId, onRename, onAdd, onDelete, onEdit }: { column: Column; index: number; cards: Card[]; activeCardId: string | null; onRename: (id: string, title: string) => void; onAdd: (id: string) => void; onDelete: (id: string) => void; onEdit: (card: Card) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.title);
  const activeCardIndex = cards.findIndex((card) => card.id === activeCardId);

  function finishRename() {
    const nextName = name.trim();
    if (nextName) onRename(column.id, nextName);
    else setName(column.title);
    setEditing(false);
  }

  return (
    <section ref={setNodeRef} className={`board-column column-${columnColors[index]}${isOver ? " column-over" : ""}`} aria-label={`${column.title} column`}>
      <div className="column-topline" />
      <header className="column-header">
        <div className="column-title-row">
          <span className="column-dot" aria-hidden="true" />
          {editing ? <input className="column-name-input" autoFocus aria-label={`Rename ${column.title} column`} maxLength={32} value={name} onChange={(event) => setName(event.target.value)} onBlur={finishRename} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setName(column.title); setEditing(false); } }} /> : <button className="column-name" type="button" title="Rename column" onClick={() => { setName(column.title); setEditing(true); }}>{column.title}</button>}
          <span className="column-count">{cards.length}</span>
        </div>
        <button className="column-add" type="button" aria-label={`Add card to ${column.title}`} onClick={() => onAdd(column.id)}><Plus size={20} /></button>
      </header>
      <div className="column-cards">{cards.map((card, cardIndex) => <DraggableCard key={card.id} card={card} onDelete={onDelete} onEdit={onEdit} dropAfter={activeCardIndex >= 0 && activeCardIndex < cardIndex} />)}</div>
    </section>
  );
}

export default function Board({ onLogout }: { onLogout: () => void }) {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [error, setError] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));
  const activeCard = board?.cards.find((card) => card.id === activeId);
  const total = board?.cards.length ?? 0;
  const completed = board?.cards.filter((card) => card.columnId === "done").length ?? 0;

  useEffect(() => {
    fetch("/api/board")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your board.");
        return response.json();
      })
      .then(setBoard)
      .catch((cause) => setError(cause.message));
  }, []);

  async function mutate(path: string, method: string, body?: object): Promise<boolean> {
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error("Could not save your change. Please try again.");
      setBoard(await response.json());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your change.");
      return false;
    }
  }

  function openAdd(columnId: string) {
    setEditingCard(null);
    setAddingTo(columnId);
    setTitle("");
    setDetails("");
  }

  function openEdit(card: Card) {
    setAddingTo(null);
    setEditingCard(card);
    setTitle(card.title);
    setDetails(card.details);
  }

  function closeEditor() {
    setAddingTo(null);
    setEditingCard(null);
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const saved = editingCard
      ? await mutate(`/api/cards/${editingCard.id}`, "PATCH", { title, details })
      : addingTo ? await mutate("/api/cards", "POST", { columnId: addingTo, title, details }) : false;
    if (saved) closeEditor();
  }

  async function endDrag(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || !board) return;
    const targetId = String(event.over.id);
    if (targetId.startsWith("card:")) {
      const targetCardId = targetId.slice(5);
      const targetCard = board.cards.find((card) => card.id === targetCardId);
      if (targetCard) await mutate(`/api/cards/${event.active.id}/move`, "POST", { columnId: targetCard.columnId, targetCardId });
    } else {
      await mutate(`/api/cards/${event.active.id}/move`, "POST", { columnId: targetId });
    }
  }

  if (!board) return <div className="auth-loading">{error || "Loading your board..."}</div>;

  return (
    <div className="app-shell">
      <main className="main-content">
        <div className="topbar">
          <div className="brand"><div className="brand-symbol"><span /><span /><span /><span /></div><span>kanban<span className="brand-period">.</span></span></div>
          <div className="topbar-actions"><span className="breadcrumb">My board</span><button className="logout-button" type="button" onClick={onLogout}><LogOut size={15} /> Sign out</button></div>
        </div>
        <div className="content-inner">
          <div className="page-heading"><div><div className="eyebrow"><span /> PROJECT BOARD</div><h1>Make things happen<span>.</span></h1><p>One clear view of everything in motion.</p></div></div>
          <div className="board-meta"><div className="board-meta-left"><div className="board-icon"><LayoutGrid size={19} /></div><div><h2>Project board</h2><p>Keep ideas moving from start to finish.</p></div></div><div className="board-stats"><span><strong>{total}</strong> cards</span><i /><span><strong>{completed}</strong> completed</span></div></div>
          {error && <div className="board-error" role="alert">{error}</div>}
          <DndContext id="project-board" sensors={sensors} collisionDetection={cardFirstCollision} onDragStart={(event) => setActiveId(String(event.active.id))} onDragEnd={endDrag} onDragCancel={() => setActiveId(null)}>
            <div className="board-scroll"><div className="board-grid">{board.columns.map((column, index) => <BoardColumn key={column.id} column={column} index={index} cards={board.cards.filter((card) => card.columnId === column.id)} activeCardId={activeId} onRename={(columnId, name) => { void mutate(`/api/columns/${columnId}`, "PATCH", { title: name }); }} onAdd={openAdd} onDelete={(cardId) => { void mutate(`/api/cards/${cardId}`, "DELETE"); }} onEdit={openEdit} />)}</div></div>
            <DragOverlay>{activeCard ? <TaskCard card={activeCard} overlay /> : null}</DragOverlay>
          </DndContext>
          <div className="board-help"><span>TIP</span> Drag cards to reorder them or move them between columns. <ArrowUpRight size={15} /></div>
        </div>
      </main>
      <ChatSidebar onBoardUpdate={setBoard} />
      {(addingTo || editingCard) && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="modal-eyebrow">{editingCard ? "EDIT CARD" : "NEW CARD"}</span><h2 id="modal-title">{editingCard ? "Refine this task." : "Add something great."}</h2></div><button type="button" className="modal-close" aria-label="Close dialog" onClick={closeEditor}><X size={20} /></button></div><form onSubmit={saveCard}><label htmlFor="card-title">Title</label><input id="card-title" autoFocus maxLength={100} placeholder="What needs to get done?" value={title} onChange={(event) => setTitle(event.target.value)} required /><label htmlFor="card-details">Details</label><textarea id="card-details" rows={4} placeholder="Add a little more context..." value={details} onChange={(event) => setDetails(event.target.value)} /><div className="modal-footer"><button type="button" className="cancel-button" onClick={closeEditor}>Cancel</button><button type="submit" className="save-button"><Check size={18} /> {editingCard ? "Save changes" : "Create card"}</button></div></form></div></div>}
    </div>
  );
}
