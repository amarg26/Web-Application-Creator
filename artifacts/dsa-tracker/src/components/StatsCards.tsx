import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Question } from "@/lib/revision";
import { Brain, CheckCircle2, Target, TrendingDown } from "lucide-react";

export function StatsCards({ questions }: { questions: Question[] }) {
  const total = questions.length;
  const weak = questions.filter(q => q.confidence <= 2).length;
  const strong = questions.filter(q => q.confidence >= 4).length;

  const weakQuestions = questions.filter(q => q.confidence <= 2);
  const tagCounts: Record<string, number> = {};
  weakQuestions.forEach(q => {
    q.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  let mostFrequentWeakTopic = "None";
  let maxCount = 0;
  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentWeakTopic = tag;
    }
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="stats-cards">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Solved</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono">{total}</div>
        </CardContent>
      </Card>
      
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Weak Topics (≤2)</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono text-red-500">{weak}</div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Strong Topics (≥4)</CardTitle>
          <Target className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono text-emerald-500">{strong}</div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Focus Area</CardTitle>
          <Brain className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold truncate" title={mostFrequentWeakTopic}>
            {mostFrequentWeakTopic}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
