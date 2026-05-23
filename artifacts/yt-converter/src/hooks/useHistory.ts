import { useState, useEffect } from "react";
import { TranscriptResult } from "@workspace/api-client-react";

export interface HistoryItem extends TranscriptResult {
  savedAt: string;
}

const STORAGE_KEY = "yt-converter-history";

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const addToHistory = (result: TranscriptResult) => {
    setHistory(prev => {
      const filtered = prev.filter(item => item.videoId !== result.videoId);
      const updated = [{ ...result, savedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { history, addToHistory, clearHistory };
}
