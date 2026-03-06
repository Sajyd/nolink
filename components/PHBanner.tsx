import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Rocket, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

const STORAGE_KEY = "ph-banner-dismissed";
const PROMO_CODE = "PH50FIRST100";

export default function PHBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  function copyCode() {
    navigator.clipboard.writeText(PROMO_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative z-50 overflow-hidden bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white"
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 sm:gap-5 text-sm sm:text-base">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
              <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                <Rocket className="w-4 h-4" />
                {t("phBanner.launch")}
              </span>

              <span className="hidden sm:inline text-white/70">|</span>

              <span className="font-medium">
                <span className="font-bold">{t("phBanner.discount")}</span>{" "}
                {t("phBanner.offer")}
              </span>

              <button
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm font-mono font-bold text-sm transition-colors cursor-pointer"
              >
                {PROMO_CODE}
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1 px-4 py-1 rounded-lg bg-white text-red-600 font-semibold text-sm hover:bg-white/90 transition-colors whitespace-nowrap"
              >
                {t("phBanner.claimOffer")}
              </Link>
            </div>

            <button
              onClick={dismiss}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/20 transition-colors"
              aria-label={t("common.close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
