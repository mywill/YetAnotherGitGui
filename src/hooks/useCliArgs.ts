import { useEffect, useState } from "react";
import { getMatches } from "@tauri-apps/plugin-cli";
import { getCurrentDir } from "../services/git";

export function useCliArgs() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getCliArgs() {
      try {
        const matches = await getMatches();
        const pathArg = matches.args.path;

        if (
          pathArg &&
          pathArg.value &&
          typeof pathArg.value === "string" &&
          pathArg.value.length > 0
        ) {
          setRepoPath(pathArg.value);
        } else {
          // Default to the directory where the command was run
          const cwd = await getCurrentDir();
          setRepoPath(cwd);
        }
      } catch {
        // CLI parsing can fail in dev mode due to extra args like --no-default-features
        // This is expected, just use the fallback silently
        try {
          const cwd = await getCurrentDir();
          setRepoPath(cwd);
        } catch {
          setRepoPath(".");
        }
      } finally {
        setLoading(false);
      }
    }

    getCliArgs();
  }, []);

  return { repoPath, loading };
}
