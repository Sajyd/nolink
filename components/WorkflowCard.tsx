import Link from "next/link";
import { Zap, Play, Eye, Tag } from "lucide-react";

interface WorkflowCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  priceInNolinks: number;
  totalUses: number;
  stepsCount: number;
  creatorName?: string;
  tags?: string[];
  slug: string;
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

export default function WorkflowCard({
  id,
  name,
  description,
  category,
  priceInNolinks,
  totalUses,
  stepsCount,
  creatorName,
  tags,
  slug,
}: WorkflowCardProps) {
  return (
    <Link href={`/workflow/${id}`}>
      <div className="card p-5 h-full flex flex-col gap-3 group cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 transition-all">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`badge text-[11px] ${CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER}`}
          >
            {category.replace("_", " ")}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
            <Zap className="w-3.5 h-3.5" />
            {priceInNolinks} NL
          </span>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-base group-hover:text-brand-600 transition-colors line-clamp-1">
            {name}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge-gray text-[10px]">
                <Tag className="w-2.5 h-2.5 mr-0.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {totalUses} runs
          </span>
          <span>{stepsCount} steps</span>
          {creatorName && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {creatorName}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
