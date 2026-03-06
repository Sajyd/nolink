import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  ArrowRight,
  Sparkles,
  Play,
  Store,
  Hammer,
  Layers,
  ChevronRight,
  Gift,
  Rocket,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const TOTAL_STEPS = 4;
const CONFETTI_COUNT = 60;
const CREDIT_TARGET = 50;
const CREDIT_VALUE_USD = "1.00";

function ConfettiPiece({ index }: { index: number }) {
  const colors = [
    "#5c7cfa", "#845ef7", "#f783ac", "#ffd43b",
    "#69db7c", "#4ecdc4", "#ff6b6b", "#a78bfa",
  ];
  const style = {
    left: `${Math.random() * 100}%`,
    animationDuration: `${2 + Math.random() * 3}s`,
    animationDelay: `${Math.random() * 0.8}s`,
    backgroundColor: colors[index % colors.length],
    width: `${6 + Math.random() * 8}px`,
    height: `${6 + Math.random() * 8}px`,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
  };

  return (
    <div
      className="fixed top-0 z-50 opacity-0"
      style={{ ...style, animation: `confetti-fall ${style.animationDuration} ease-out ${style.animationDelay} forwards` }}
    />
  );
}

function CreditCounter({ target, onComplete }: { target: number; onComplete: () => void }) {
  const [count, setCount] = useState(0);
  const completed = useRef(false);

  useEffect(() => {
    let frame: number;
    let start: number;
    const duration = 2000;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else if (!completed.current) {
        completed.current = true;
        onComplete();
      }
    };

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, 400);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [target, onComplete]);

  return (
    <span className="tabular-nums">{count}</span>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const stepVariants = {
  enter: { opacity: 0, y: 30, scale: 0.96 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.96 },
};

export default function Welcome() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [creditsDone, setCreditsDone] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [popularWorkflows, setPopularWorkflows] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/register");
    }
  }, [status, router]);

  useEffect(() => {
    if (step === 0) {
      const timer = setTimeout(() => setShowConfetti(true), 300);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    fetch("/api/workflows?sort=popular&limit=3")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPopularWorkflows(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  const handleCreditComplete = useCallback(() => setCreditsDone(true), []);

  const nextStep = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    }
  };

  const name = session?.user?.name?.split(" ")[0] || "there";

  if (status === "loading") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>{t("welcome.title")}</title>
      </Head>

      {showConfetti && step === 0 && (
        <div className="pointer-events-none fixed inset-0 z-50">
          {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>
      )}

      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="mb-8">
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>

        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* STEP 1: You're in */}
            {step === 0 && (
              <motion.div
                key="step-0"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/25"
                >
                  <Zap className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="text-4xl sm:text-5xl font-extrabold gradient-text mb-3"
                >
                  {t("welcome.youreIn")}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2"
                >
                  {t("welcome.welcomeName", { name })}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-gray-500 dark:text-gray-400 mb-10"
                >
                  {t("welcome.accountReady")}
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.4 }}
                  onClick={nextStep}
                  className="btn-primary gap-2 text-base px-8 py-3"
                >
                  {t("welcome.next")}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {/* STEP 2: Credits loaded */}
            {step === 1 && (
              <motion.div
                key="step-1"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25"
                >
                  <Gift className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-bold mb-8"
                >
                  {t("welcome.yourWallet")}
                </motion.h2>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 150 }}
                  className="relative inline-block mb-6"
                >
                  <div className="absolute inset-0 rounded-2xl bg-brand-500/10 dark:bg-brand-500/5 animate-pulse-ring" />
                  <div className="relative bg-white dark:bg-gray-900 border-2 border-brand-200 dark:border-brand-800 rounded-2xl px-10 py-8 shadow-xl">
                    <div className="text-6xl sm:text-7xl font-extrabold animate-counter-glow gradient-text">
                      <CreditCounter target={CREDIT_TARGET} onComplete={handleCreditComplete} />
                      <span className="text-3xl ml-2 font-bold text-brand-500">NL</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {t("welcome.freeCredits")}
                    </p>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {creditsDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="text-gray-600 dark:text-gray-300 mb-2">
                        {t("welcome.creditValue", { value: CREDIT_VALUE_USD })}
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
                        {t("welcome.readyToSpend")}
                      </p>

                      <button onClick={nextStep} className="btn-primary gap-2 text-base px-8 py-3">
                        {t("welcome.next")}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* STEP 3: Pick your path */}
            {step === 2 && (
              <motion.div
                key="step-2"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/25"
                >
                  <Rocket className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-bold mb-2"
                >
                  {t("welcome.whatWillYouBuild")}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-gray-500 dark:text-gray-400 mb-8"
                >
                  {t("welcome.pickYourPath")}
                </motion.p>

                <div className="grid gap-3 max-w-md mx-auto mb-8">
                  {[
                    { id: "run", icon: Play, label: t("welcome.pathRun"), desc: t("welcome.pathRunDesc") },
                    { id: "build", icon: Hammer, label: t("welcome.pathBuild"), desc: t("welcome.pathBuildDesc") },
                    { id: "both", icon: Layers, label: t("welcome.pathBoth"), desc: t("welcome.pathBothDesc") },
                  ].map((path, i) => (
                    <motion.button
                      key={path.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                      onClick={() => setSelectedPath(path.id)}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200
                        ${selectedPath === path.id
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30 shadow-md shadow-brand-500/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                        }
                      `}
                    >
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                        ${selectedPath === path.id
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }
                      `}>
                        <path.icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{path.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{path.desc}</p>
                      </div>
                      {selectedPath === path.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto flex-shrink-0"
                        >
                          <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: selectedPath ? 1 : 0.4 }}
                  onClick={nextStep}
                  disabled={!selectedPath}
                  className="btn-primary gap-2 text-base px-8 py-3 disabled:cursor-not-allowed"
                >
                  {t("welcome.next")}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {/* STEP 4: First hit free */}
            {step === 3 && (
              <motion.div
                key="step-3"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/25"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-2xl sm:text-3xl font-bold mb-2"
                >
                  {t("welcome.firstHitFree")}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-gray-500 dark:text-gray-400 mb-8"
                >
                  {t("welcome.tryTopWorkflow")}
                </motion.p>

                {popularWorkflows.length > 0 && (
                  <div className="space-y-3 max-w-md mx-auto mb-8">
                    {popularWorkflows.map((wf, i) => (
                      <motion.div
                        key={wf.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
                      >
                        <Link
                          href={`/workflow/${wf.id}`}
                          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-100 to-violet-100 dark:from-brand-900/40 dark:to-violet-900/40 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                          </div>
                          <div className="min-w-0 text-left flex-1">
                            <p className="font-semibold text-sm truncate">{wf.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {wf.price === 0 ? "Free" : `${wf.price} NL`} · {wf._count?.runs || 0} {t("common.runs")}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center"
                >
                  <Link href="/marketplace" className="btn-primary gap-2 text-base px-8 py-3">
                    <Store className="w-4 h-4" />
                    {t("welcome.exploreMarketplace")}
                  </Link>
                  <Link href="/dashboard" className="btn-secondary gap-2 text-base px-8 py-3">
                    {t("welcome.goToDashboard")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="mt-8 text-xs text-gray-400 dark:text-gray-500"
                >
                  {t("welcome.creditsWaiting")}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < TOTAL_STEPS - 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            onClick={() => router.push("/dashboard")}
            className="mt-12 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {t("welcome.skipToDashboard")}
          </motion.button>
        )}
      </div>
    </>
  );
}
