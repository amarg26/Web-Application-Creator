import { useLocation, useParams, Link } from "wouter";
import { ArrowLeft, TerminalSquare } from "lucide-react";
import { useQuestions } from "@/hooks/useQuestions";
import { QuestionForm } from "@/components/QuestionForm";
import { Button } from "@/components/ui/button";

export default function EditQuestion() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { getQuestion, updateQuestion } = useQuestions();

  const questionId = params.id as string;
  const question = getQuestion(questionId);

  const handleSubmit = (data: any) => {
    updateQuestion(questionId, data);
    setLocation("/");
  };

  if (!question) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-2">Question Not Found</h2>
        <p className="text-muted-foreground mb-4">The question you are trying to edit does not exist.</p>
        <Link href="/">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-12">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4 max-w-4xl">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 border-l border-border/50 pl-4">
            <TerminalSquare className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg tracking-tight font-mono">Edit Question</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-card/30 backdrop-blur border border-border/50 rounded-xl p-6 shadow-sm">
          <QuestionForm initialData={question} onSubmit={handleSubmit} />
        </div>
      </main>
    </div>
  );
}
