import { useState } from "react";
import { TranscriptResult } from "@workspace/api-client-react";
import { formatSeconds, splitIntoSections, splitIntoParagraphs } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranscriptResultProps {
  result: TranscriptResult;
  onReset: () => void;
}

export function TranscriptResultView({ result, onReset }: TranscriptResultProps) {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

  const sections = splitIntoSections(result.segments);
  const paragraphs = splitIntoParagraphs(result.transcript);

  const toggleSection = (i: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const expandAll = () => setOpenSections(new Set(sections.map((_, i) => i)));
  const collapseAll = () => setOpenSections(new Set());

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.transcript);
      toast({ title: "Copied to clipboard", description: "The full transcript has been copied." });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="overflow-hidden border-border/50 shadow-sm">
        {/* Video metadata header */}
        <div className="flex flex-col md:flex-row bg-muted/30">
          <div className="w-full md:w-64 shrink-0 p-4">
            <div className="aspect-video bg-muted rounded-md overflow-hidden shadow-sm">
              <img
                src={`https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`}
                alt={result.title}
                className="object-cover w-full h-full"
              />
            </div>
          </div>
          <CardHeader className="flex-1 p-4 md:p-6 justify-center">
            <CardTitle
              className="text-xl md:text-2xl line-clamp-2"
              data-testid="text-video-title"
            >
              {result.title}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              <span
                data-testid="text-video-duration"
                className="inline-flex items-center gap-1 font-medium bg-muted px-2 py-1 rounded-md text-foreground/80"
              >
                <Clock className="h-3 w-3" />
                {formatSeconds(result.duration)}
              </span>
              <span data-testid="text-video-words" className="text-muted-foreground">
                {result.wordCount.toLocaleString()} words
              </span>
              <span className="text-muted-foreground">
                {sections.length} section{sections.length !== 1 ? "s" : ""}
              </span>
            </CardDescription>
          </CardHeader>
        </div>

        <CardContent className="p-4 md:p-6 pt-0 mt-4">
          <Tabs defaultValue="sections" className="w-full">
            {/* Tab bar + action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-3">
                <TabsTrigger value="sections" data-testid="tab-sections">Sections</TabsTrigger>
                <TabsTrigger value="full" data-testid="tab-full-text">Full Text</TabsTrigger>
                <TabsTrigger value="timestamped" data-testid="tab-timestamped">Timestamped</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  data-testid="button-copy"
                  className="flex-1 sm:flex-none"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  data-testid="button-download"
                  className="flex-1 sm:flex-none"
                >
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            </div>

            {/* ── SECTIONS TAB ── */}
            <TabsContent value="sections" className="mt-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs text-muted-foreground">
                  Transcript split into ~2-minute sections
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    data-testid="button-expand-all"
                    className="text-xs text-primary hover:underline"
                  >
                    Expand all
                  </button>
                  <span className="text-muted-foreground text-xs">/</span>
                  <button
                    onClick={collapseAll}
                    data-testid="button-collapse-all"
                    className="text-xs text-primary hover:underline"
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <div
                className="rounded-xl border bg-muted/10 min-h-[300px] max-h-[520px] overflow-y-auto shadow-inner divide-y divide-border/50"
                data-testid="sections-container"
              >
                {sections.map((section, i) => {
                  const isOpen = openSections.has(i);
                  return (
                    <div key={i} data-testid={`section-${i}`}>
                      {/* Section header */}
                      <button
                        onClick={() => toggleSection(i)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left group"
                        data-testid={`section-toggle-${i}`}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                        )}
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded shrink-0">
                          {section.label}
                        </span>
                        <span className="text-sm font-medium text-foreground/80 truncate">
                          Section {i + 1}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {section.bullets.length} point{section.bullets.length !== 1 ? "s" : ""}
                        </span>
                      </button>

                      {/* Sub-sections with optional bold headings */}
                      {isOpen && (
                        <div className="px-5 pb-4 pt-1 space-y-4 bg-background/50">
                          {section.subSections.map((sub, si) => (
                            <div key={si} data-testid={`subsection-${i}-${si}`}>
                              {sub.heading && (
                                <p className="text-sm font-bold text-foreground mb-2 mt-1" data-testid={`subsection-heading-${i}-${si}`}>
                                  {sub.heading}
                                </p>
                              )}
                              <ul className="space-y-2">
                                {sub.points.map((point, pi) => (
                                  <li
                                    key={pi}
                                    className="flex gap-3 text-sm text-foreground/85 leading-relaxed"
                                    data-testid={`point-${i}-${si}-${pi}`}
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                                    <span>{point}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── FULL TEXT TAB ── */}
            <TabsContent value="full" className="mt-0">
              <div className="rounded-xl border bg-muted/10 p-6 min-h-[300px] max-h-[520px] overflow-y-auto shadow-inner space-y-4">
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className="text-sm md:text-base leading-relaxed text-foreground/90"
                    data-testid={`paragraph-${i}`}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </TabsContent>

            {/* ── TIMESTAMPED TAB ── */}
            <TabsContent value="timestamped" className="mt-0">
              <div className="rounded-xl border bg-muted/10 p-4 md:p-6 min-h-[300px] max-h-[520px] overflow-y-auto font-sans text-sm shadow-inner space-y-3">
                {result.segments.map((segment, index) => (
                  <div key={index} className="flex gap-4 group">
                    <span className="text-muted-foreground font-mono text-xs pt-1 shrink-0 group-hover:text-primary transition-colors">
                      [{formatSeconds(segment.start)}]
                    </span>
                    <p className="text-foreground/90 leading-relaxed">{segment.text}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex justify-center">
            <Button
              variant="ghost"
              onClick={onReset}
              data-testid="button-convert-another"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Convert Another
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
