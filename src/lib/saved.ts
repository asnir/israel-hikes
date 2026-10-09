import { useState } from "react";
export function useSaved() {
  const [saved, S] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("israel-hikes-saved") || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  function toggle(id: string) {
    S((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        localStorage.setItem("israel-hikes-saved", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return { saved, toggle };
}
