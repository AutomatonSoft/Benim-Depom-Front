"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Notification = {
  id: number;
  title: string;
  body: string;
  notification_type: string;
  product_id: number | null;
  is_read: boolean;
  created_at: string;
};

type NotificationListResponse = {
  next: string | null;
  previous: string | null;
  results: Notification[];
};

function messageTitle(notification: Notification) {
  return notification.title || notification.notification_type.replaceAll("_", " ");
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUnread, setShowUnread] = useState(false);

  useEffect(() => {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/login");
      return;
    }

    async function loadMessages() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/v1/notifications/?page=${page}`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        if (response.status === 401) {
          window.localStorage.removeItem("benim_access_token");
          window.localStorage.removeItem("benim_refresh_token");
          window.location.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("request failed");

        const data = (await response.json()) as NotificationListResponse;
        setMessages(data.results);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
      } catch {
        setError("Unable to load messages. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadMessages();
  }, [page]);

  async function markRead(id: number) {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) return;
    const response = await fetch(`/api/v1/notifications/${id}/read/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    });
    if (response.ok) {
      setMessages((items) => items.map((item) => item.id === id ? { ...item, is_read: true } : item));
    }
  }

  async function markAllRead() {
    const access = window.localStorage.getItem("benim_access_token");
    if (!access) return;
    const response = await fetch("/api/v1/notifications/read-all/", {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    });
    if (response.ok) setMessages((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  const visibleMessages = showUnread ? messages.filter((item) => !item.is_read) : messages;
  const unreadCount = messages.filter((item) => !item.is_read).length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">Benim<span>Depom</span></Link>
        <nav aria-label="Main navigation">
          <Link className="nav-item" href="/"><span className="icon">O</span> Overview</Link>
          <Link className="nav-item" href="/products"><span className="icon">P</span> Products</Link>
          <Link className="nav-item" href="/sellers"><span className="icon">S</span> Sellers</Link>
          <Link className="nav-item active" href="/messages"><span className="icon">M</span> Messages</Link>
        </nav>
      </aside>

      <section className="content products-page">
        <header className="topbar">
          <div><p className="eyebrow">Manager panel</p><h1>Messages</h1><p className="products-subtitle">Your account notifications</p></div>
          <button className="mark-all" disabled={!unreadCount} onClick={markAllRead}>Mark all read</button>
        </header>

        <section className="messages-panel">
          <div className="messages-toolbar">
            <button className={!showUnread ? "active" : ""} onClick={() => setShowUnread(false)}>All</button>
            <button className={showUnread ? "active" : ""} onClick={() => setShowUnread(true)}>Unread {unreadCount ? `(${unreadCount})` : ""}</button>
          </div>
          {loading && <p className="products-message">Loading messages...</p>}
          {error && <p className="products-message error" role="alert">{error}</p>}
          {!loading && !error && !visibleMessages.length && <p className="products-message">No {showUnread ? "unread " : ""}messages.</p>}
          {!loading && !error && visibleMessages.map((message) => <article className={`message-row ${message.is_read ? "read" : "unread"}`} key={message.id}>
            <button className="message-content" onClick={() => !message.is_read && void markRead(message.id)}>
              <span className="message-dot" aria-hidden="true" />
              <span><strong>{messageTitle(message)}</strong><small>{message.body || "No details provided."}</small>{message.product_id && <em>Product #{message.product_id}</em>}</span>
            </button>
            <time dateTime={message.created_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(message.created_at))}</time>
          </article>)}
          <footer className="pagination"><button disabled={!hasPrevious || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next</button></footer>
        </section>
      </section>
    </main>
  );
}