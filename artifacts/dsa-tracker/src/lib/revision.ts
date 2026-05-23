import { addDays, isBefore, isToday, parseISO, startOfDay } from "date-fns";

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface Question {
  id: string;
  name: string;
  platform: "LeetCode" | "GFG" | "Codeforces" | "Other";
  tags: string[];
  approach: string;
  timeComplexity: string;
  confidence: ConfidenceLevel;
  lastRevisedDate: string;
  mistakeNotes: string;
  createdAt: string;
}

export function getNextRevisionDate(lastRevisedDate: string, confidence: ConfidenceLevel): Date {
  const baseDate = startOfDay(parseISO(lastRevisedDate));
  
  switch (confidence) {
    case 1:
      return addDays(baseDate, 2);
    case 2:
      return addDays(baseDate, 3);
    case 3:
      return addDays(baseDate, 5);
    case 4:
      return addDays(baseDate, 7);
    case 5:
      return addDays(baseDate, 10);
    default:
      return addDays(baseDate, 2);
  }
}

export function isRevisionOverdue(lastRevisedDate: string, confidence: ConfidenceLevel): boolean {
  const nextRev = getNextRevisionDate(lastRevisedDate, confidence);
  const today = startOfDay(new Date());
  return isBefore(nextRev, today) || isToday(nextRev);
}

export function getConfidenceColor(confidence: ConfidenceLevel): { bg: string, text: string, border: string } {
  if (confidence <= 2) {
    return { bg: "bg-red-500/10 dark:bg-red-500/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-900/50" };
  } else if (confidence === 3) {
    return { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-900/50" };
  } else {
    return { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-900/50" };
  }
}

export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 1: return "Very Weak";
    case 2: return "Weak";
    case 3: return "Medium";
    case 4: return "Strong";
    case 5: return "Expert";
  }
}
