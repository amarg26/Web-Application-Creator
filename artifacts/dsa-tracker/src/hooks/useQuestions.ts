import { useLocalStorage } from "./useLocalStorage";
import { Question } from "@/lib/revision";

const STORAGE_KEY = "dsa-tracker-questions";

export function useQuestions() {
  const [questions, setQuestions] = useLocalStorage<Question[]>(STORAGE_KEY, []);

  const addQuestion = (question: Omit<Question, "id" | "createdAt">) => {
    const newQuestion: Question = {
      ...question,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setQuestions((prev) => [...prev, newQuestion]);
    return newQuestion;
  };

  const updateQuestion = (id: string, updates: Partial<Omit<Question, "id" | "createdAt">>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions((prev) => prev.map((q) => q).filter((q) => q.id !== id));
  };

  const markAsRevised = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          return {
            ...q,
            lastRevisedDate: new Date().toISOString(),
          };
        }
        return q;
      })
    );
  };

  const getQuestion = (id: string) => {
    return questions.find((q) => q.id === id);
  };

  return {
    questions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    markAsRevised,
    getQuestion,
  };
}
