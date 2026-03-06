import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, Zap, AlertTriangle, DollarSign, MessageSquare, PlayCircle, XCircle, Sparkles, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  WORKFLOW_USED: PlayCircle,
  CREDITS_EARNED: Zap,
  EXECUTION_COMPLETED: Check,
  EXECUTION_FAILED: XCircle,
  PAYOUT_COMPLETED: DollarSign,
  PAYOUT_FAILED: AlertTriangle,
  SUPPORT_REPLY: MessageSquare,
  WELCOME: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  WORKFLOW_USED: "text-brand-600",
  CREDITS_EARNED: "text-yellow-500",
  EXECUTION_COMPLETED: "text-green-500",
  EXECUTION_FAILED: "text-red-500",
  PAYOUT_COMPLETED: "text-green-600",
  PAYOUT_FAILED: "text-red-500",
  SUPPORT_REPLY: "text-blue-500",
  WELCOME: "text-brand-500",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const handleClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative btn-ghost p-2"
        aria-label={t("notifications.title")}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[380px] max-h-[480px] card shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold">{t("notifications.title")}</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="btn-ghost text-xs px-2 py-1 gap-1"
                    title={t("notifications.markAllRead")}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t("notifications.markAllRead")}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="btn-ghost p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("notifications.empty")}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("notifications.emptyDesc")}
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  const color = TYPE_COLORS[n.type] || "text-gray-500";
                  return (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        !n.read ? "bg-brand-50/50 dark:bg-brand-900/10" : ""
                      }`}
                      onClick={() => handleClick(n)}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium text-gray-700 dark:text-gray-300"}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-brand-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 btn-ghost p-1 flex-shrink-0 mt-0.5 transition-opacity"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
