import { TranscriptResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { formatSeconds } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranscriptResultProps {
  result: TranscriptResult;
  onReset: () => void;
}

export function TranscriptResultView({ result, onReset }: TranscriptResultProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.transcript);
      toast({
        title: "Copied to clipboard",
        description: "The full transcript has been copied.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "An error occurred while copying to clipboard.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <div className="flex flex-col md:flex-row bg-muted/30">
          <div className="w-full md:w-64 shrink-0 p-4">
            <div className="aspect-video bg-muted rounded-md overflow-hidden shadow-sm relative">
              <img 
                src={`https://img.youtube.com/vi/${result.videoId}/hqdefault.jpg`} 
                alt={result.title}
                className="object-cover w-full h-full"
              />
            </div>
          </div>
          <CardHeader className="flex-1 p-4 md:p-6 justify-center">
            <CardTitle className="text-xl md:text-2xl line-clamp-2" data-testid="text-video-title">{result.title}</CardTitle>
            <CardDescription className="flex items-center gap-4 mt-2 text-sm">
              <span data-testid="text-video-duration" className="font-medium bg-muted px-2 py-1 rounded-md text-foreground/80">{formatSeconds(result.duration)}</span>
              <span data-testid="text-video-words" className="text-muted-foreground">{result.wordCount.toLocaleString()} words</span>
            </CardDescription>
          </CardHeader>
        </div>

        <CardContent className="p-4 md:p-6 pt-0 mt-4">
          <Tabs defaultValue="full" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <TabsList className="grid w-full sm:w-[300px] grid-cols-2">
                <TabsTrigger value="full" data-testid="tab-full-text">Full Text</TabsTrigger>
                <TabsTrigger value="timestamped" data-testid="tab-timestamped">Timestamped</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy" className="flex-1 sm:flex-none">
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download" className="flex-1 sm:flex-none">
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
              </div>
            </div>

            <TabsContent value="full" className="mt-0">
              <div className="rounded-xl border bg-muted/10 p-6 min-h-[300px] max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed text-foreground/90 shadow-inner">
                {result.transcript}
              </div>
            </TabsContent>
            
            <TabsContent value="timestamped" className="mt-0">
              <div className="rounded-xl border bg-muted/10 p-4 md:p-6 min-h-[300px] max-h-[500px] overflow-y-auto font-sans text-sm shadow-inner space-y-3">
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
            <Button variant="ghost" onClick={onReset} data-testid="button-convert-another" className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="mr-2 h-4 w-4" /> Convert Another
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
