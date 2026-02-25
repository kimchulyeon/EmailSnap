import { useMailStore } from "../stores/mailStore";
import { CATEGORY_CONFIG, type CategoryFilter as CategoryFilterType } from "../types";

const FILTERS: { key: CategoryFilterType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "urgent", label: "긴급" },
  { key: "approval", label: "결재" },
  { key: "external", label: "외부" },
  { key: "internal", label: "내부" },
  { key: "system", label: "시스템" },
];

function CategoryFilter() {
  const { filter, setFilter } = useMailStore();

  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-zinc-800">
      {FILTERS.map(({ key, label }) => {
        const isActive = filter === key;
        const config =
          key !== "all" ? CATEGORY_CONFIG[key] : null;

        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            style={
              isActive
                ? {
                    backgroundColor: config
                      ? config.color + "30"
                      : "rgba(255,255,255,0.1)",
                  }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default CategoryFilter;
