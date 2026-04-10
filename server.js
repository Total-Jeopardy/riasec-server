const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Original RIASEC endpoint ──────────────────────────────────────────────────
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

// ── Hymnal extraction endpoint ────────────────────────────────────────────────
app.post('/extract-hymn', async (req, res) => {
  const { imageBase64, mediaType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, error: 'No image provided' });
  }

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
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `You are a hymnal data extraction engine.
Extract ALL hymns visible on this scanned hymnal page.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

Return a JSON array. Each hymn must match this exact shape:
{
  "id": "celebration:45",
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

STRICT RULES:
1. Extract ONLY hymns visible on this page
2. If two hymns appear (end of one + start of another), return BOTH as separate objects
3. NEVER merge multiple hymns into one object
4. Ignore musical notation, staff lines, page numbers, and section headers
5. Preserve exact wording — keep hyphenation like heav'n-ly, o'er, tho', 'tis
6. Detect verse numbers (1, 2, 3...) and group lines under the correct verse
7. If a chorus or refrain is clearly labeled, use type "chorus" — otherwise set chorus to null
8. Never guess or hallucinate missing words — skip unreadable lines only
9. id = "celebration:" + number
10. firstLine = first lyrical line of verse 1, not the title
11. Return ONLY the JSON array, nothing else`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    // surface API-level errors clearly
    if (data.error) {
      return res.status(500).json({ success: false, error: data.error.message });
    }

    const raw = data.content[0].text.trim();

    // strip markdown fences if Claude added them anyway
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const hymns = JSON.parse(cleaned);
    res.json({ success: true, hymns });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
