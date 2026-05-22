import { useEffect, useState } from "react";
import { useBranchFilterStore } from "../../stores/branchFilterStore";
import { SEARCH_DEBOUNCE_MS } from "../../hooks/useCommandPaletteSearch";
import { BranchList } from "./BranchList";
import { TagList } from "./TagList";

export function BranchTagList() {
  const filterQuery = useBranchFilterStore((s) => s.query);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(filterQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterQuery]);

  return (
    <div className="branch-tag-list flex flex-col gap-3">
      <BranchList filterQuery={debouncedQuery} />
      <TagList filterQuery={debouncedQuery} />
    </div>
  );
}
