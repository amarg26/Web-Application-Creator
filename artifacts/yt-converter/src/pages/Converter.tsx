// Trigger rebuild
import { useState } from "react";

import { TranscriptResult } from "@workspace/api-client-react";
import { useHistory } from "@/hooks/useHistory";
import { UrlInput } from "@/components/UrlInput";
import { TranscriptResultView } from "@/components/TranscriptResult";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SiYoutube } from "react-icons/si";
import { extractVideoId } from "@/lib/utils/format";

export default function Converter() {
  const [activeResult, setActiveResult] = useState<TranscriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { history, addToHistory, clearHistory } = useHistory();

  const handleConvert = async (url: string) => {
    setActiveResult(null);
    setError(null);
    setIsLoading(true);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('Invalid YouTube URL');
      setIsLoading(false);
      return;
    }

    const WORKER_URL = 'https://yttextconverter.amar-ghodke30.workers.dev';

    try {
      const playerRes = await fetch(`${WORKER_URL}/player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: "19.09.37",
              androidSdkVersion: 34,
              hl: "en",
              gl: "US"
            }
          }
        })
      });

      if (!playerRes.ok) throw new Error(`Player HTTP ${playerRes.status}`);
      const playerData = await playerRes.json();

      const captions = playerData?.captions?.captionTracks;
      if (!captions || captions.length === 0) {
        throw new Error('No captions available for this video');
      }

      const captionUrl = captions[0].baseUrl;

      const textRes = await fetch(`${WORKER_URL}/timedtext`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: captionUrl, videoId })
      });

      if (!textRes.ok) throw new Error(`Timedtext HTTP ${textRes.status}`);
      const xmlText = await textRes.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const texts = xmlDoc.querySelectorAll('text');
      const transcript = Array.from(texts).map(t => t.textContent).join(' ');

      const result = {
        videoId,
        title: playerData?.videoDetails?.title || 'Unknown',
        transcript,
        captions: Array.from(texts).map((t) => ({
          start: t.getAttribute('start'),
          duration: t.getAttribute('dur'),
          text: t.textContent
        }))
      };

      setActiveResult(result);
      addToHistory(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transcript');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (item: TranscriptResult) => {
    setActiveResult(null);
    setTimeout(() => {
      setActiveResult(item);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <SiYoutube className="w-6 h-6 text-primary" />
          <h1 className="font-bold tracking-tight text-lg">YT Converter</h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
        
        <div className="w-full text-center mb-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
            YouTube to Text
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Extract the full transcript from any YouTube video instantly. No ads, no clutter.
          </p>
        </div>

        <UrlInput 
          onSubmit={handleConvert} 
          isLoading={isLoading} 
          error={error}
        />

        {activeResult ? (
          <TranscriptResultView 
            result={activeResult} 
            onReset={() => setActiveResult(null)} 
          />
        ) : (
          <HistoryPanel 
            history={history} 
            onSelect={handleHistorySelect} 
            onClear={clearHistory} 
          />
        )}
        
      </main>
      
      <footer className="w-full py-6 text-center text-sm text-muted-foreground border-t border-border/40">
        <p>A focused productivity tool for text extraction.</p>
      </footer>
    </div>
  );
}
