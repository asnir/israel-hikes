import {parseSaved,toggleSaved,savedKey} from "./saved-state";
import { useState } from "react";
export function useSaved() {
  const [saved, S] = useState<string[]>(() => {
    try {
      return parseSaved(localStorage.getItem(savedKey));
    } catch {
      return [];
    }
  });
  function toggle(id: string) {
    S((prev) => {
      const next = toggleSaved(prev,id);
      try {
        localStorage.setItem(savedKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return { saved, toggle };
}
