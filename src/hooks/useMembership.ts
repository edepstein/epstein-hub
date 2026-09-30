"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMembership } from "@/lib/dictionary";

/** Loads the pinned membership word list once; exposes loading/error/retry states. */
export function useMembership() {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; words: ReadonlySet<string> | null; error?: string }>({
    status: "loading",
    words: null,
  });
  const load = useCallback(() => {
    setState({ status: "loading", words: null });
    loadMembership()
      .then((words) => setState({ status: "ready", words }))
      .catch((e: unknown) => setState({ status: "error", words: null, error: e instanceof Error ? e.message : "Word list unavailable" }));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, retry: load };
}
