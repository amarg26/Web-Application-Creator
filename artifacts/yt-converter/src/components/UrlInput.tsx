import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractVideoId } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export function UrlInput({ onSubmit, isLoading, error }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    if (!url.trim()) {
      setLocalError("Please enter a URL");
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      setLocalError("Invalid YouTube URL. Please make sure it's a valid link.");
      return;
    }

    onSubmit(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <Input
          data-testid="input-youtube-url"
          type="url"
          placeholder="Paste YouTube URL here (e.g., https://youtube.com/watch?v=...)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setLocalError(null);
          }}
          className="h-14 text-base px-4 rounded-xl shadow-sm focus-visible:ring-primary/20"
          disabled={isLoading}
        />
        <Button 
          data-testid="button-convert"
          type="submit" 
          disabled={isLoading} 
          className="h-14 px-8 rounded-xl font-semibold shadow-sm transition-all"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : "Convert"}
        </Button>
      </form>
      
      {(error || localError) && (
        <p data-testid="text-error-message" className="text-destructive text-sm font-medium text-center">
          {error || localError}
        </p>
      )}
    </div>
  );
}
