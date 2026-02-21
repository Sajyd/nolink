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

const FEATURES = [
  {
    icon: Layers,
    title: "Visual Workflow Builder",
    description:
      "Drag-and-drop whiteboard to chain AI models together. Text, image, audio, video, documents — all connected.",
  },
  {
    icon: Sparkles,
    title: "Multi-Model AI",
    description:
      "GPT-4, DALL·E 3, Whisper, Stable Diffusion, Runway, ElevenLabs — pick the right model for each step.",
  },
  {
    icon: CreditCard,
    title: "Pay-Per-Use Credits",
    description:
      "Buy Nolinks credits or subscribe monthly. Run any workflow for a transparent, predictable cost.",
  },
  {
    icon: Globe,
    title: "Marketplace",
    description:
      "Publish your workflows and earn commissions. Discover automation built by the community.",
  },
  {
    icon: Play,
    title: "One-Click Execution",
    description:
      "Submit your input and watch the workflow run step-by-step. Results appear in real time.",
  },
  {
    icon: Shield,
    title: "Creator Earnings",
    description:
      "Creators earn 70% commission on every paid workflow run via Stripe Connect. Automatic payouts.",
  },
];

const FALLBACK_EXAMPLES = [
  { name: "Blog → Social Media", steps: 3, category: "Content", price: 8, slug: "" },
  { name: "Audio Transcription + Summary", steps: 2, category: "Audio", price: 5, slug: "" },
  { name: "Product Image + Description", steps: 3, category: "Marketing", price: 12, slug: "" },
  { name: "Code Review Pipeline", steps: 2, category: "Development", price: 6, slug: "" },
  { name: "PDF Analysis Report", steps: 3, category: "Data", price: 10, slug: "" },
];

interface WorkflowExample {
  name: string;
  steps: number;
  category: string;
  price: number;
  slug: string;
}

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home({ popularWorkflows }: { popularWorkflows: WorkflowExample[] }) {
  const { data: session } = useSession();
  const examples = popularWorkflows.length > 0 ? popularWorkflows : FALLBACK_EXAMPLES;

  return (
    <div className="dark:bg-gradient-to-b dark:from-[#0a1628] dark:via-[#060f1f] dark:to-black">
      <Head>
        <title>nolink.ai — AI Workflow Marketplace</title>
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
              AI Workflow Marketplace
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
              Chain AI models.
              <br />
              <span className="gradient-text">Ship automations.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Build multi-step AI workflows with a visual editor. Combine text,
              image, audio, video, and document models — then publish to the
              marketplace or keep them private.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {session ? (
                <>
                  <Link href="/create-workflow" className="btn-primary text-base px-8 py-3 gap-2">
                    Create Workflow
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/marketplace" className="btn-secondary text-base px-8 py-3">
                    Browse Marketplace
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/register" className="btn-primary text-base px-8 py-3 gap-2">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/marketplace" className="btn-secondary text-base px-8 py-3">
                    Explore Workflows
                  </Link>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-3xl mx-auto"
          >
            {examples.map((w) => {
              const inner = (
                <>
                  <p className="text-[10px] text-brand-500 font-medium">{formatCategory(w.category)}</p>
                  <p className="text-xs font-semibold mt-1 truncate">{w.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {w.steps} steps · {w.price} NL
                  </p>
                </>
              );
              return w.slug ? (
                <Link
                  key={w.name}
                  href={`/workflow/${w.slug}`}
                  className="card p-3 text-center hover:scale-105 transition-transform"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={w.name}
                  className="card p-3 text-center hover:scale-105 transition-transform cursor-default"
                >
                  {inner}
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Everything you need to{" "}
            <span className="gradient-text">automate with AI</span>
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Build, share, and monetize multi-step AI workflows.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="card p-6 hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-brand-600" />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="card p-10 sm:p-16 bg-gradient-to-br from-brand-600 to-violet-600 !border-0 text-white">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to build?</h2>
          <p className="mt-4 text-brand-100 text-lg max-w-lg mx-auto">
            Start with 50 free Nolinks. Create your first workflow in minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={session ? "/create-workflow" : "/auth/register"}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-brand-700 font-semibold hover:bg-brand-50 transition-colors"
            >
              {session ? "Create Workflow" : "Sign Up Free"}
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
          <p>&copy; {new Date().getFullYear()} nolink.ai. All rights reserved.</p>
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
      take: 5,
    });

    const popularWorkflows: WorkflowExample[] = workflows.map((w) => ({
      name: w.name,
      steps: w.steps.length,
      category: w.category,
      price: w.priceInNolinks,
      slug: w.slug,
    }));

    return { props: { popularWorkflows } };
  } catch {
    return { props: { popularWorkflows: [] } };
  }
};
