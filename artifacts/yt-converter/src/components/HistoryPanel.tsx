import { HistoryItem } from "@/hooks/useHistory";
import { formatSeconds } from "@/lib/utils/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HistoryPanelProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelect, onClear }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-12 text-center text-muted-foreground p-8 border border-dashed rounded-xl bg-muted/5" data-testid="container-empty-history">
        <History className="w-8 h-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Your recent conversions will appear here</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-12 space-y-4 animate-in fade-in duration-500" data-testid="container-history">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" /> Recent Conversions
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs" data-testid="button-clear-history">
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        {history.map((item) => (
          <Card 
            key={item.videoId} 
            className="overflow-hidden hover:border-primary/50 cursor-pointer transition-all hover:shadow-md group flex h-20"
            onClick={() => onSelect(item)}
            data-testid={`card-history-${item.videoId}`}
          >
            <div className="w-28 shrink-0 relative overflow-hidden bg-muted">
              <img 
                src={`https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`} 
                alt={item.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                {formatSeconds(item.duration)}
              </div>
            </div>
            <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
              <h4 className="text-sm font-semibold truncate text-foreground/90 group-hover:text-primary transition-colors">
                {item.title}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{item.wordCount.toLocaleString()} words</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                <span>{formatDistanceToNow(new Date(item.savedAt), { addSuffix: true })}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
