import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Plus, TerminalSquare } from "lucide-react";
import { useQuestions } from "@/hooks/useQuestions";
import { StatsCards } from "@/components/StatsCards";
import { FilterState, SearchFilters } from "@/components/SearchFilters";
import { QuestionTable } from "@/components/QuestionTable";
import { getNextRevisionDate } from "@/lib/revision";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { Moon, Sun } from "lucide-react";

export default function Dashboard() {
  const { questions, deleteQuestion, markAsRevised } = useQuestions();
  const { theme, setTheme } = useTheme();
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    confidence: "all",
    platform: "all",
    sort: "nextRevision",
  });

  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    // Text search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(q => 
        q.name.toLowerCase().includes(searchLower) || 
        q.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    // Confidence filter
    if (filters.confidence !== "all") {
      if (filters.confidence === "weak") result = result.filter(q => q.confidence <= 2);
      else if (filters.confidence === "medium") result = result.filter(q => q.confidence === 3);
      else if (filters.confidence === "strong") result = result.filter(q => q.confidence >= 4);
    }

    // Platform filter
    if (filters.platform !== "all") {
      result = result.filter(q => q.platform === filters.platform);
    }

    // Sort
    result.sort((a, b) => {
      if (filters.sort === "name") {
        return a.name.localeCompare(b.name);
      } else if (filters.sort === "confidence") {
        return a.confidence - b.confidence;
      } else {
        // nextRevision (default)
        const dateA = getNextRevisionDate(a.lastRevisedDate, a.confidence);
        const dateB = getNextRevisionDate(b.lastRevisedDate, b.confidence);
        return dateA.getTime() - dateB.getTime();
      }
    });

    return result;
  }, [questions, filters]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-12">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-1.5 rounded-md">
              <TerminalSquare className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-bold text-lg tracking-tight font-mono">DSA<span className="text-primary">Tracker</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="h-9 w-9"
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Link href="/add">
              <Button size="sm" className="gap-1.5 font-mono text-xs uppercase tracking-wider" data-testid="btn-add">
                <Plus className="h-3.5 w-3.5" /> Log Question
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <section>
          <h2 className="text-xl font-bold mb-4 font-mono tracking-tight">Overview</h2>
          <StatsCards questions={questions} />
        </section>

        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <h2 className="text-xl font-bold font-mono tracking-tight">Revision Queue</h2>
            <SearchFilters filters={filters} setFilters={setFilters} />
          </div>
          
          <QuestionTable 
            questions={filteredQuestions} 
            onDelete={deleteQuestion} 
            onRevise={markAsRevised} 
          />
        </section>
      </main>
    </div>
  );
}
