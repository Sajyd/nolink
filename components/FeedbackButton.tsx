import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareHeart, Star, Send, X, Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/lib/i18n";

interface FeedbackButtonProps {
  page: string;
  workflowId?: string;
  workflowName?: string;
}

export default function FeedbackButton({ page, workflowId, workflowName }: FeedbackButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nudge, setNudge] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(`feedback-nudge-${page}`);
    if (!dismissed) {
      const timer = setTimeout(() => setNudge(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [page]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message, page, workflowId }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success(t("feedback.thanks"));
        setTimeout(() => {
          setOpen(false);
          setSubmitted(false);
          setRating(0);
          setMessage("");
        }, 2000);
      } else {
        toast.error(t("common.somethingWentWrong"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setSubmitting(false);
  };

  const dismissNudge = () => {
    setNudge(false);
    sessionStorage.setItem(`feedback-nudge-${page}`, "1");
  };

  const handleOpen = () => {
    dismissNudge();
    setOpen(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-30" ref={panelRef}>
      {/* Nudge tooltip */}
      <AnimatePresence>
        {nudge && !open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="absolute bottom-16 right-0 w-64 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
          >
            <button
              onClick={dismissNudge}
              className="absolute top-2 right-2 p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("feedback.nudgeTitle")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t("feedback.nudgeDesc")}
                </p>
              </div>
            </div>
            <div className="absolute -bottom-2 right-6 w-4 h-4 rotate-45 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="absolute bottom-16 right-0 w-80 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
          >
            {submitted ? (
              <div className="p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3"
                >
                  <Sparkles className="w-7 h-7 text-emerald-500" />
                </motion.div>
                <p className="font-semibold text-gray-900 dark:text-white">{t("feedback.thanksTitle")}</p>
                <p className="text-sm text-gray-500 mt-1">{t("feedback.thanksDesc")}</p>
              </div>
            ) : (
              <>
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {workflowName
                        ? t("feedback.rateWorkflow")
                        : t("feedback.title")}
                    </h3>
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {workflowName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                      {workflowName}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("feedback.subtitle")}
                  </p>
                </div>

                <div className="px-5 pb-4 space-y-3">
                  {/* Star rating */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                      {t("feedback.ratingLabel")}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => setRating(star)}
                          className="p-0.5 transition-transform hover:scale-110 active:scale-95"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              star <= (hoveredStar || rating)
                                ? "text-amber-400 fill-amber-400"
                                : "text-gray-300 dark:text-gray-600"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text feedback */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                      {t("feedback.messageLabel")}
                    </p>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="input-field resize-none text-sm"
                      placeholder={t("feedback.placeholder")}
                      maxLength={500}
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={rating === 0 || submitting}
                    className="btn-primary w-full gap-2 text-sm"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {t("feedback.submit")}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={handleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={nudge && !open ? { scale: [1, 1.1, 1] } : {}}
        transition={nudge && !open ? { repeat: Infinity, duration: 2, repeatDelay: 3 } : {}}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-600 to-purple-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
        title={t("feedback.title")}
      >
        <MessageSquareHeart className="w-5 h-5" />
      </motion.button>
    </div>
  );
}

// Inline workflow-end feedback card (appears after workflow completes)
export function WorkflowEndFeedback({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName: string;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          message,
          page: "workflow-end",
          workflowId,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success(t("feedback.thanks"));
      } else {
        toast.error(t("common.somethingWentWrong"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    }
    setSubmitting(false);
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 20 }}
      className="mt-6 card p-5 border-brand-200 dark:border-brand-800 bg-gradient-to-r from-brand-50/60 to-purple-50/60 dark:from-brand-950/20 dark:to-purple-950/15"
    >
      {submitted ? (
        <div className="flex items-center gap-3 py-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{t("feedback.thanksTitle")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("feedback.thanksDesc")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/40 dark:to-purple-900/30 flex items-center justify-center shrink-0">
                <MessageSquareHeart className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("feedback.endTitle")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("feedback.endDesc", { name: workflowName })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(star)}
                className="p-0.5 transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= (hoveredStar || rating)
                      ? "text-amber-400 fill-amber-400"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-xs font-medium text-gray-500">
                {rating}/5
              </span>
            )}
          </div>

          <AnimatePresence>
            {rating > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="input-field resize-none text-sm mb-3"
                  placeholder={t("feedback.endPlaceholder")}
                  maxLength={500}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-primary gap-2 text-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {t("feedback.submit")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
