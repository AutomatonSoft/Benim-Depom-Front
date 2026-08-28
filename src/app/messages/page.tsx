"use client";

import { useEffect, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { formatDate } from "@/lib/date";

type Notification = { id: number; title: string; body: string; notification_type: string; product_id: number | null; is_read: boolean; created_at: string };
type NotificationList = { next: string | null; previous: string | null; results: Notification[] };

export default function MessagesPage() {
  const [messages, setMessages] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/login");
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/v1/notifications/?page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) return void window.location.replace("/login");
        if (!response.ok) throw new Error();
        const data = await response.json() as NotificationList;
        setMessages(data.results); setNext(Boolean(data.next)); setPrevious(Boolean(data.previous));
      } catch { setError("Unable to load messages. Please try again."); } finally { setLoading(false); }
    }
    void load();
  }, [page]);

  async function read(id: number) {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    const response = await fetch(`/api/v1/notifications/${id}/read/`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setMessages((items) => items.map((item) => item.id === id ? { ...item, is_read: true } : item));
  }

  async function readAll() {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    const response = await fetch("/api/v1/notifications/read-all/", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setMessages((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  const visible = unreadOnly ? messages.filter((item) => !item.is_read) : messages;
  const unread = messages.filter((item) => !item.is_read).length;
  return <main className="app-shell"><Sidebar active="messages" /><section className="content products-page">
    <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Messages</h1><p className="products-subtitle">Your account notifications</p></div><button className="mark-all" disabled={!unread} onClick={readAll}>Mark all read</button></header>
    <section className="messages-panel"><div className="messages-toolbar"><button className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>All</button><button className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>Unread {unread ? `(${unread})` : ""}</button></div>
      {loading && <p className="products-message">Loading messages...</p>}{error && <p className="products-message error">{error}</p>}
      {!loading && !error && !visible.length && <p className="products-message">No {unreadOnly ? "unread " : ""}messages.</p>}
      {!loading && !error && visible.map((message) => <article className={`message-row ${message.is_read ? "read" : "unread"}`} key={message.id}><button className="message-content" onClick={() => !message.is_read && void read(message.id)}><span className="message-dot" /><span><strong>{message.title || message.notification_type.replaceAll("_", " ")}</strong><small>{message.body || "No details provided."}</small>{message.product_id && <em>Product #{message.product_id}</em>}</span></button><time>{formatDate(message.created_at, true)}</time></article>)}
      <footer className="pagination"><button disabled={!previous || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={!next || loading} onClick={() => setPage((value) => value + 1)}>Next</button></footer>
    </section></section></main>;
}