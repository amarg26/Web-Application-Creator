# YouTube Innertube Proxy (Cloudflare Worker)

YouTube blocks GCP Cloud Run IP ranges from accessing transcripts. This free Cloudflare Worker proxies those requests through Cloudflare's edge network, which is not blocked.

## Deploy in 5 steps (free, no credit card)

1. Go to https://workers.cloudflare.com and sign up / log in
2. Click **Create Application → Create Worker**
3. Replace all the default code with the contents of `worker.js`
4. Click **Deploy**
5. Copy the worker URL shown (e.g. `https://yt-proxy.your-name.workers.dev`)

## Add the URL to your Replit app

In your Replit project:
1. Open **Secrets** (lock icon in the left sidebar)
2. Add a new secret:
   - Key: `YT_PROXY_URL`
   - Value: your worker URL (e.g. `https://yt-proxy.your-name.workers.dev`)
3. Redeploy your app

That's it. The server will automatically route all YouTube requests through the proxy.

## How it works

```
User browser
    │
    ▼
Replit API Server (GCP — blocked by YouTube)
    │  YT_PROXY_URL set → proxy all Innertube calls
    ▼
Cloudflare Worker (Cloudflare edge — NOT blocked)
    │
    ▼
YouTube API → transcript returned
```

## Free tier limits

- 100,000 requests/day
- No credit card required
