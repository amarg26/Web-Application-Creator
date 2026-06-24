const express = require('express');
const { YoutubeTranscript } = require('youtube-transcript');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/transcript', async (req, res) => {
  try {
    const { videoId } = req.body;
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    res.json({ 
      videoId,
      transcript: transcript.map(t => t.text).join(' '),
      captions: transcript
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
