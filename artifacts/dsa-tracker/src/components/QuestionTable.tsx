import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Edit2, Trash2, CheckSquare, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Question, getConfidenceColor, getNextRevisionDate, isRevisionOverdue } from "@/lib/revision";
import { cn } from "@/lib/utils";

interface QuestionTableProps {
  questions: Question[];
  onDelete: (id: string) => void;
  onRevise: (id: string) => void;
}

export function QuestionTable({ questions, onDelete, onRevise }: QuestionTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card/30" data-testid="empty-state">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No questions found</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          You haven't added any questions yet, or no questions match your current filters.
        </p>
        <Link href="/add" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 bg-primary text-primary-foreground border border-primary-border shadow-sm min-h-9 px-4 py-2" data-testid="button-add-empty">
          Add First Question
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 overflow-hidden bg-card/30 backdrop-blur" data-testid="question-table">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[300px]">Question</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="hidden md:table-cell">Tags</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="hidden lg:table-cell">Last Revised</TableHead>
            <TableHead>Next Rev.</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => {
            const nextRevDate = getNextRevisionDate(q.lastRevisedDate, q.confidence);
            const isOverdue = isRevisionOverdue(q.lastRevisedDate, q.confidence);
            const confColors = getConfidenceColor(q.confidence);
            const isExpanded = expandedRows.has(q.id);

            return (
              <React.Fragment key={q.id}>
                <TableRow className={cn("group cursor-pointer", isExpanded && "border-b-0 bg-muted/20")} onClick={() => toggleRow(q.id)} data-testid={`row-${q.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="truncate">{q.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">{q.platform}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {q.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] bg-secondary/50">{tag}</Badge>
                      ))}
                      {q.tags.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] bg-secondary/50">+{q.tags.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold", confColors.bg, confColors.text, confColors.border)}>
                      Level {q.confidence}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-xs">
                    {format(new Date(q.lastRevisedDate), "MMM dd")}
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                      "font-mono text-xs px-2 py-1 rounded-md inline-flex items-center gap-1.5", 
                      isOverdue ? "bg-red-500/10 text-red-500 border border-red-500/20" : "text-muted-foreground"
                    )}>
                      {isOverdue && <AlertCircle className="h-3 w-3" />}
                      {format(nextRevDate, "MMM dd")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn("h-8 w-8", isOverdue && "border-primary text-primary hover:bg-primary/10")} 
                        onClick={() => onRevise(q.id)}
                        title="Mark as Revised"
                        data-testid={`btn-revise-${q.id}`}
                      >
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                      <Link href={`/edit/${q.id}`} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover-elevate active-elevate-2 border [border-color:var(--button-outline)] shadow-xs active:shadow-none h-8 w-8" data-testid={`btn-edit-${q.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(q.id)} data-testid={`btn-delete-${q.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={7} className="p-0 border-t-0">
                      <div className="p-4 pl-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Approach</h4>
                          <p className="whitespace-pre-wrap text-foreground/80 font-mono text-xs bg-background/50 p-2 rounded border border-border/50">{q.approach || "No approach logged."}</p>
                          
                          <h4 className="font-semibold mt-3 mb-1 text-xs uppercase tracking-wider text-muted-foreground">Time Complexity</h4>
                          <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{q.timeComplexity || "O(?)"}</code>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Mistake Notes</h4>
                          <p className="whitespace-pre-wrap text-foreground/80 font-mono text-xs bg-red-500/5 p-2 rounded border border-red-500/10 text-red-400">{q.mistakeNotes || "No mistakes noted."}</p>
                          
                          <div className="mt-3 flex flex-wrap gap-1">
                            <h4 className="w-full font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">All Tags</h4>
                            {q.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px] bg-secondary/50">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
