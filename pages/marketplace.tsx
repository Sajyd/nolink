import { useState, useEffect } from "react";
import Head from "next/head";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import WorkflowCard from "@/components/WorkflowCard";

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  priceInNolinks: number;
  totalUses: number;
  slug: string;
  tags: string[];
  creator: { name: string; image: string | null };
  steps: { id: string }[];
}

const CATEGORIES = [
  "ALL",
  "CONTENT",
  "MARKETING",
  "DEVELOPMENT",
  "DESIGN",
  "AUDIO_VIDEO",
  "DATA",
  "EDUCATION",
  "OTHER",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "price", label: "Lowest Price" },
];

export default function Marketplace() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [freeOnly, setFreeOnly] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [category, sort, freeOnly]);

  const fetchWorkflows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (sort) params.set("sort", sort);
    if (freeOnly) params.set("free", "true");
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/workflows?${params}`);
      const data = await res.json();
      setWorkflows(data);
    } catch {
      setWorkflows([]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWorkflows();
  };

  return (
    <>
      <Head>
        <title>Marketplace — nolink.ai</title>
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Discover and run AI workflows built by the community
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 pr-4"
              placeholder="Search workflows..."
            />
          </form>

          <div className="flex gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-field text-sm w-auto"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setFreeOnly(!freeOnly)}
              className={`btn-ghost text-sm gap-1.5 ${
                freeOnly ? "!bg-brand-50 !text-brand-600 dark:!bg-brand-900/20" : ""
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Free Only
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {cat === "ALL" ? "All" : cat.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="card p-5 h-48 animate-pulse bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20">
            <SlidersHorizontal className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">
              No workflows found
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                id={wf.id}
                name={wf.name}
                description={wf.description}
                category={wf.category}
                priceInNolinks={wf.priceInNolinks}
                totalUses={wf.totalUses}
                stepsCount={wf.steps.length}
                creatorName={wf.creator.name || undefined}
                tags={wf.tags}
                slug={wf.slug}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
