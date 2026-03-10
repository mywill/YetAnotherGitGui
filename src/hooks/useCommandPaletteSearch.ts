import { useMemo, useState, useEffect, useRef } from "react";
import { useRepositoryStore } from "../stores/repositoryStore";
import type { FilterCategory } from "../stores/commandPaletteStore";

export interface SearchResult {
  category: FilterCategory;
  label: string;
  detail: string;
  data: unknown;
  id: string;
}

const ALL_MODE_LIMIT = 5;
const FILTERED_MODE_LIMIT = 50;
const DEBOUNCE_MS = 150;

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function useCommandPaletteSearch(
  query: string,
  activeFilter: FilterCategory
): SearchResult[] {
  const commits = useRepositoryStore((s) => s.commits);
  const branches = useRepositoryStore((s) => s.branches);
  const tags = useRepositoryStore((s) => s.tags);
  const stashes = useRepositoryStore((s) => s.stashes);
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];

    const results: SearchResult[] = [];
    const isAll = activeFilter === "all";
    const limit = isAll ? ALL_MODE_LIMIT : FILTERED_MODE_LIMIT;

    // Commits
    if (isAll || activeFilter === "commits") {
      let count = 0;
      for (const c of commits) {
        if (count >= limit) break;
        if (
          matchesQuery(c.message, q) ||
          matchesQuery(c.short_hash, q) ||
          matchesQuery(c.hash, q)
        ) {
          results.push({
            category: "commits",
            label: c.message,
            detail: c.short_hash,
            data: c,
            id: `commit-${c.hash}`,
          });
          count++;
        }
      }
    }

    // Branches
    if (isAll || activeFilter === "branches") {
      let count = 0;
      for (const b of branches) {
        if (count >= limit) break;
        if (matchesQuery(b.name, q)) {
          results.push({
            category: "branches",
            label: b.name,
            detail: b.is_remote ? "remote" : b.is_head ? "HEAD" : "local",
            data: b,
            id: `branch-${b.name}`,
          });
          count++;
        }
      }
    }

    // Tags
    if (isAll || activeFilter === "tags") {
      let count = 0;
      for (const t of tags) {
        if (count >= limit) break;
        if (matchesQuery(t.name, q)) {
          results.push({
            category: "tags",
            label: t.name,
            detail: t.is_annotated ? "annotated" : "lightweight",
            data: t,
            id: `tag-${t.name}`,
          });
          count++;
        }
      }
    }

    // Authors
    if (isAll || activeFilter === "authors") {
      const seen = new Set<string>();
      let count = 0;
      for (const c of commits) {
        if (count >= limit) break;
        const name = c.author_name;
        if (!seen.has(name) && matchesQuery(name, q)) {
          seen.add(name);
          results.push({
            category: "authors",
            label: name,
            detail: c.author_email,
            data: c,
            id: `author-${name}`,
          });
          count++;
        }
      }
    }

    // Files
    if (isAll || activeFilter === "files") {
      if (fileStatuses) {
        const allFiles = [
          ...fileStatuses.staged,
          ...fileStatuses.unstaged,
          ...fileStatuses.untracked,
        ];
        let count = 0;
        for (const f of allFiles) {
          if (count >= limit) break;
          if (matchesQuery(f.path, q)) {
            results.push({
              category: "files",
              label: f.path,
              detail: f.status,
              data: f,
              id: `file-${f.is_staged ? "staged" : "unstaged"}-${f.path}`,
            });
            count++;
          }
        }
      }
    }

    // Stashes
    if (isAll || activeFilter === "stashes") {
      let count = 0;
      for (const s of stashes) {
        if (count >= limit) break;
        if (matchesQuery(s.message, q)) {
          results.push({
            category: "stashes",
            label: s.message,
            detail: `stash@{${s.index}}`,
            data: s,
            id: `stash-${s.index}`,
          });
          count++;
        }
      }
    }

    return results;
  }, [debouncedQuery, activeFilter, commits, branches, tags, stashes, fileStatuses]);
}
