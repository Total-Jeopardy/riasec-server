const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // increased for images

// Your original endpoint — unchanged
app.post('/generate', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// New endpoint for hymn extraction
app.post('/extract-hymn', async (req, res) => {
  const { imageBase64, mediaType } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `You are a hymnal data extraction engine.
Extract ALL hymns visible on this scanned hymnal page.
Return ONLY valid JSON (no markdown, no explanation).

Return a JSON array. Each item must match this shape:
{
  "id": "celebration:<number>",
  "hymnalId": "celebration",
  "number": 45,
  "title": "Blessed Assurance",
  "firstLine": "Blessed assurance, Jesus is mine!",
  "section": "PRAISE AND WORSHIP",
  "key": "G",
  "meter": "L.M.",
  "tune_name": "BLESSED ASSURANCE",
  "text_author": "Fanny Crosby",
  "music_author": "Phoebe Knapp",
  "copyright": null,
  "canonicalId": null,
  "tags": [],
  "categories": [],
  "verses": [
    {
      "type": "verse",
      "label": "1",
      "lines": ["Line 1", "Line 2"]
    }
  ],
  "chorus": null,
  "media": { "audio": null, "sheet": null }
}

RULES:
1. Extract ONLY hymns visible on this page
2. If two hymns appear, return BOTH as separate objects
3. NEVER merge multiple hymns into one
4. Ignore musical notation, staff lines, page numbers, section headers
5. Preserve exact wording including hyphenation like heav'n-ly and o'er
6. Detect verse numbers and group lines correctly
7. If chorus is clearly labeled use type chorus — otherwise set chorus to null
8. Never hallucinate missing words
9. Return only JSON`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.trim();
    const hymns = JSON.parse(text);
    res.json({ success: true, hymns });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
