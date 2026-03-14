import { useState, useEffect } from "react";
import { getAppInfo } from "../services/system";

let cachedModKey: string | null = null;
let cachedPlatform: string | null = null;
let fetchPromise: Promise<void> | null = null;

function fetchPlatform(): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = getAppInfo()
      .then((info) => {
        cachedPlatform = info.platform;
        cachedModKey = info.platform === "macos" ? "Cmd" : "Ctrl";
      })
      .catch(() => {
        cachedPlatform = "unknown";
        cachedModKey = "Ctrl";
      });
  }
  return fetchPromise;
}

export function usePlatform() {
  const [modKey, setModKey] = useState(cachedModKey ?? "Ctrl");
  const [platform, setPlatform] = useState(cachedPlatform);

  useEffect(() => {
    if (cachedModKey) {
      setModKey(cachedModKey);
      setPlatform(cachedPlatform);
      return;
    }
    fetchPlatform().then(() => {
      setModKey(cachedModKey!);
      setPlatform(cachedPlatform);
    });
  }, []);

  return { modKey, platform };
}
