"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles } from "lucide-react";
import type { BoardState } from "@/lib/board";

type Message = { role: "user" | "assistant"; content: string; actionsApplied?: number };

export default function ChatSidebar({ onBoardUpdate }: { onBoardUpdate: (board: BoardState) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "The board changed. Please send that again." : "The assistant could not respond. Please try again.");
      const result: { response: string; actionsApplied: number; board: BoardState } = await response.json();
      onBoardUpdate(result.board);
      setMessages((current) => [...current, { role: "assistant", content: result.response, actionsApplied: result.actionsApplied }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant could not respond.");
    } finally {
      setBusy(false);
    }
  }

  return <aside className="chat-sidebar" aria-label="Board assistant">
    <header className="chat-header"><div className="chat-icon"><Sparkles size={18} /></div><div><h2>Board assistant</h2><p>Ideas into action, together.</p></div></header>
    <div className="chat-messages" aria-live="polite">
      <div className="chat-message assistant">Hi! Ask me about your board, or tell me what to change.</div>
      {messages.map((entry, index) => <div key={index} className={`chat-message ${entry.role}`}>{entry.content}{entry.actionsApplied ? <span className="chat-action-note">Board updated</span> : null}</div>)}
      {busy && <div className="chat-message assistant chat-thinking">Thinking...</div>}
      <div ref={bottom} />
    </div>
    <form className="chat-composer" onSubmit={send}>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <label htmlFor="chat-input">Ask or make a change</label>
      <div className="chat-input-row"><input id="chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Move a card to Done..." maxLength={2000} /><button type="submit" aria-label="Send message" disabled={busy || !draft.trim()}><Send size={17} /></button></div>
    </form>
  </aside>;
}
