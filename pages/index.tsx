import Link from "next/link";
import Head from "next/head";
import { useSession } from "next-auth/react";
import {
  Zap,
  ArrowRight,
  Layers,
  CreditCard,
  Globe,
  Sparkles,
  Play,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GetServerSideProps } from "next";
import prisma from "@/lib/prisma";
import { useTranslation } from "@/lib/i18n";

const FEATURE_KEYS = [
  { icon: Layers, titleKey: "home.featureVisualBuilder", descKey: "home.featureVisualBuilderDesc" },
  { icon: Sparkles, titleKey: "home.featureMultiModel", descKey: "home.featureMultiModelDesc" },
  { icon: CreditCard, titleKey: "home.featureCredits", descKey: "home.featureCreditsDesc" },
  { icon: Globe, titleKey: "home.featureMarketplace", descKey: "home.featureMarketplaceDesc" },
  { icon: Play, titleKey: "home.featureOneClick", descKey: "home.featureOneClickDesc" },
  { icon: Shield, titleKey: "home.featureEarnings", descKey: "home.featureEarningsDesc" },
];

const FALLBACK_EXAMPLES: WorkflowExample[] = [
  { id: "cmlxuvirh001w1v138prhvgmv", name: "30 TikTok Hooks from One Topic", description: "Enter any topic and instantly get 30 scroll-stopping TikTok hooks organized by style — curiosity, controversy, storytelling, authority, and more.", steps: 4, category: "CONTENT", price: 6, slug: "tiktok-hooks-generator", tags: ["tiktok", "hooks", "viral", "content creation"], totalUses: 488 },
  { id: "cmlxuvhhv00091v13mdgigtlc", name: "AI Image Generator", description: "Generate stunning images from text prompts using FLUX.1 Pro. Describe what you want and get a high-quality AI-generated image.", steps: 3, category: "DESIGN", price: 5, slug: "ai-image-generator", tags: ["image", "art", "design", "ai-art"], totalUses: 389 },
  { id: "cmlxuvivx00221v13a8ju71bl", name: "CV → Tailored Job Application", description: "Paste your CV and the job description to get a tailored cover letter, optimized resume bullet points, and interview prep talking points.", steps: 4, category: "CONTENT", price: 10, slug: "cv-to-job-application", tags: ["cv", "resume", "job application", "cover letter"], totalUses: 312 },
  { id: "cmlxuvimz001q1v139spgq654", name: "YouTube → Viral Twitter Thread", description: "Paste any YouTube video URL or transcript and get a viral-ready Twitter/X thread with hooks, key insights, and engagement-optimized formatting.", steps: 4, category: "CONTENT", price: 8, slug: "youtube-to-twitter-thread", tags: ["youtube", "twitter", "thread", "viral"], totalUses: 263 },
  { id: "cmlxuvhna000e1v13lesw4nnx", name: "Audio Transcription + Summary", description: "Upload audio from meetings, podcasts, or lectures. Whisper transcribes it, then GPT-4o extracts key points and action items.", steps: 4, category: "AUDIO_VIDEO", price: 8, slug: "audio-transcribe-summarize", tags: ["audio", "transcription", "summary", "podcast"], totalUses: 217 },
  { id: "cmlxuvj0d00281v13h04swe89", name: "Cold Email Personalization at Scale", description: "Provide your product/service info and target prospect details to get highly personalized cold email sequences with subject lines, follow-ups, and A/B variants.", steps: 4, category: "MARKETING", price: 10, slug: "cold-email-personalization", tags: ["cold email", "sales", "outreach", "personalization"], totalUses: 198 },
];

interface WorkflowExample {
  id: string;
  name: string;
  description: string;
  steps: number;
  category: string;
  price: number;
  slug: string;
  tags: string[];
  totalUses: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  CONTENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  MARKETING: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  DEVELOPMENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DESIGN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  AUDIO_VIDEO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  DATA: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  EDUCATION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home({ popularWorkflows }: { popularWorkflows: WorkflowExample[] }) {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const examples = popularWorkflows.length > 0 ? popularWorkflows : FALLBACK_EXAMPLES;

  return (
    <div className="dark:bg-gradient-to-b dark:from-[#0a1628] dark:via-[#060f1f] dark:to-black">
      <Head>
        <title>{t("home.title")}</title>
      </Head>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/50 to-transparent dark:from-blue-950/40 dark:to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-200/20 via-transparent to-transparent dark:from-blue-900/20" />

        <div className="relative max-w-5xl mx-auto px-4 pt-24 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              {t("home.badge")}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
              {t("home.headline1")}
              <br />
              <span className="gradient-text">{t("home.headline2")}</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              {t("home.subtitle")}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {session ? (
                <>
                  <Link href="/create-workflow" className="btn-primary text-base px-8 py-3 gap-2">
                    {t("home.createWorkflow")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/marketplace" className="btn-secondary text-base px-8 py-3">
                    {t("home.browseMarketplace")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/register" className="btn-primary text-base px-8 py-3 gap-2">
                    {t("home.getStartedFree")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/marketplace" className="btn-secondary text-base px-8 py-3">
                    {t("home.exploreWorkflows")}
                  </Link>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-20 max-w-5xl mx-auto"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              <span className="gradient-text">{t("home.popularWorkflows")}</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              {t("home.popularSubtitle")}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              {examples.map((w, i) => (
                <motion.div
                  key={w.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                >
                  <Link
                    href={w.id ? `/workflow/${w.id}` : "/marketplace"}
                    className="card p-5 h-full flex flex-col gap-3 group hover:border-brand-300 dark:hover:border-brand-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`badge text-[11px] ${CATEGORY_COLORS[w.category] || CATEGORY_COLORS.OTHER}`}>
                        {formatCategory(w.category)}
                      </span>
                      {w.price === 0 ? (
                        <span className="badge-green">{t("common.free")}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
                          <Zap className="w-3.5 h-3.5" />
                          {w.price} NL
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                        {w.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {w.description}
                      </p>
                    </div>

                    {w.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {w.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="badge-gray text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        {w.totalUses > 0 ? `${w.totalUses} ${t("common.runs")}` : t("common.new")} · {w.steps} {t("common.steps")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
                        {t("common.tryIt")} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            {t("home.featuresTitle")}
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            {t("home.featuresSubtitle")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_KEYS.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="card p-6 hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-brand-600" />
              </div>
              <h3 className="font-semibold text-lg">{t(feature.titleKey)}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(feature.descKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="card p-10 sm:p-16 bg-gradient-to-br from-brand-600 to-violet-600 !border-0 text-white">
          <h2 className="text-3xl sm:text-4xl font-bold">{t("home.readyToBuild")}</h2>
          <p className="mt-4 text-brand-100 text-lg max-w-lg mx-auto">
            {t("home.readyCta")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={session ? "/create-workflow" : "/auth/register"}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-brand-700 font-semibold hover:bg-brand-50 transition-colors"
            >
              {session ? t("home.createWorkflow") : t("home.signUpFree")}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>nolink.ai</span>
          </div>
          <p>&copy; {new Date().getFullYear()} nolink.ai. {t("common.allRightsReserved")}</p>
        </div>
      </footer>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { isPublic: true },
      include: { steps: { select: { id: true } } },
      orderBy: { totalUses: "desc" },
      take: 6,
    });

    const popularWorkflows: WorkflowExample[] = workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      steps: w.steps.length,
      category: w.category,
      price: w.priceInNolinks,
      slug: w.slug,
      tags: w.tags,
      totalUses: w.totalUses,
    }));

    return { props: { popularWorkflows } };
  } catch {
    return { props: { popularWorkflows: [] } };
  }
};
