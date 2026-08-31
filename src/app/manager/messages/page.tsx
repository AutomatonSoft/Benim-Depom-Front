"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

type Notification = { id: number; title: string; body: string; notification_type: string; product_id: number | null; is_read: boolean; created_at: string };
type NotificationList = { next: string | null; previous: string | null; results: Notification[] };

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await authorizedFetch(`/api/v1/notifications/?page=${page}`);
        if (response.status === 401) return void window.location.replace("/manager/login");
        if (!response.ok) throw new Error();
        const data = await response.json() as NotificationList;
        setMessages(data.results); setNext(Boolean(data.next)); setPrevious(Boolean(data.previous));
      } catch { setError("Unable to load messages. Please try again."); } finally { setLoading(false); }
    }
    void load();
  }, [page]);

  async function openMessage(message: Notification) {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    if (!message.is_read) {
      const response = await authorizedFetch(`/api/v1/notifications/${message.id}/read/`, { method: "POST" });
      if (response.ok) setMessages((items) => items.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    }
    if (message.product_id) router.push(`/manager/products/${message.product_id}`);
  }

  async function readAll() {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return;
    const response = await authorizedFetch("/api/v1/notifications/read-all/", { method: "POST" });
    if (response.ok) setMessages((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  const visible = unreadOnly ? messages.filter((item) => !item.is_read) : messages;
  const unread = messages.filter((item) => !item.is_read).length;
  return <main className="app-shell"><Sidebar active="messages" /><section className="content products-page">
    <header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Messages</h1><p className="products-subtitle">Your account notifications</p></div><button className="mark-all" disabled={!unread} onClick={readAll}>Mark all read</button></header>
    <section className="messages-panel"><div className="messages-toolbar"><button className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>All</button><button className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>Unread {unread ? `(${unread})` : ""}</button></div>
      {loading && <p className="products-message">Loading messages...</p>}{error && <p className="products-message error">{error}</p>}
      {!loading && !error && !visible.length && <p className="products-message">No {unreadOnly ? "unread " : ""}messages.</p>}
      {!loading && !error && visible.map((message) => <article className={`message-row ${message.is_read ? "read" : "unread"}`} key={message.id}><button className="message-content" onClick={() => void openMessage(message)}><span className="message-dot" /><span><strong>{message.title || message.notification_type.replaceAll("_", " ")}</strong><small>{message.body || "No details provided."}</small>{message.product_id && <em>Open product #{message.product_id}</em>}</span></button><time>{formatDate(message.created_at, true)}</time></article>)}
      <footer className="pagination"><button disabled={!previous || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={!next || loading} onClick={() => setPage((value) => value + 1)}>Next</button></footer>
    </section></section></main>;
}
