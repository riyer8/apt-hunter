import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../lib/format.js";
import { browserPermissionDecision } from "../../lib/notifyPermission.js";
import * as api from "../../api/apartments.js";

const ASKED_KEY = "aptwatch.notificationPermissionAsked";

export default function NotificationBell({ source }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notice, setNotice] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const box = useRef(null);

  async function refresh() {
    if (source !== "api") return;
    const data = await api.listNotifications();
    setItems(data.notifications || []);
    setUnread(data.unreadCount || 0);
    return data;
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [source]);

  useEffect(() => {
    if (source !== "api") return undefined;
    const permission = typeof Notification === "undefined" ? "denied" : Notification.permission;
    const asked = localStorage.getItem(ASKED_KEY) === "1";
    const decision = browserPermissionDecision(permission, { asked });
    setNotice(decision.notice);
    setShowPrompt(decision.showPrompt);
    if (permission !== "granted") return undefined;

    let cancelled = false;
    api.listNotifications({ pending: true }).then(async (data) => {
      for (const item of data.notifications || []) {
        if (cancelled) break;
        const claimed = await api.deliverNotification(item.id);
        if (!claimed?.claimed) continue;
        const toast = new Notification(item.title, { body: item.body, icon: `${import.meta.env.BASE_URL}icon.png` });
        toast.onclick = () => {
          window.open(item.clickUrl || item.listingUrl || `/apartments/${item.apartmentId}`, "_blank");
        };
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, unread]);

  useEffect(() => {
    function onDoc(event) {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      localStorage.setItem(ASKED_KEY, "1");
      setShowPrompt(false);
      setNotice("Notifications disabled.");
      return;
    }
    const result = await Notification.requestPermission();
    localStorage.setItem(ASKED_KEY, "1");
    const decision = browserPermissionDecision(result, { asked: true });
    setShowPrompt(false);
    setNotice(decision.notice);
  }

  if (source !== "api") return null;

  return (
    <div className="notify-bell" ref={box}>
      <button type="button" className="notify-button" onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        🔔
        {unread > 0 ? <span className="notify-count">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notify-panel">
          <div className="notify-panel-head">
            <strong>Recent</strong>
            {unread > 0 ? (
              <button type="button" className="text-link" onClick={() => api.markAllNotificationsRead().then(refresh)}>
                Mark all read
              </button>
            ) : null}
          </div>
          {showPrompt ? (
            <button type="button" className="btn btn-ghost btn-small" onClick={enableNotifications}>
              Enable notifications
            </button>
          ) : null}
          {notice ? <p className="notify-notice">{notice}</p> : null}
          {items.length === 0 ? (
            <p className="notify-empty">None</p>
          ) : (
            <ul>
              {items.slice(0, 12).map((item) => (
                <li key={item.id} className={item.readAt ? "" : "unread"}>
                  <Link
                    to={item.clickUrl?.includes("/apartments/") ? `/apartments/${item.apartmentId}` : `/apartments/${item.apartmentId}`}
                    onClick={() => {
                      api.markNotificationRead(item.id).then(refresh);
                      setOpen(false);
                      if (item.listingUrl) window.open(item.listingUrl, "_blank", "noreferrer");
                    }}
                  >
                    <span>
                      {item.apartmentName}
                      {item.unit ? ` — Unit ${item.unit}` : ""}
                    </span>
                    <small>{formatRelativeTime(item.createdAt)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

