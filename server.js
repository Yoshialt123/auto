const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

/* =========================
   HYBRID HEADERS
========================= */
const HYBRID_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': '*/*'
};

/* =========================
   REACTION TABLE (your Franky part kept)
========================= */
const reactionMap = {
  like: 1,
  love: 2,
  wow: 3,
  haha: 4,
  sad: 7,
  angry: 8,
  care: 16
};

/* =========================
   UI ROUTES
========================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  res.json([...totalSessions.values()]);
});

/* =========================
   SESSION CONTROLS
========================= */
app.post('/api/pause/:id', (req, res) => {
  const s = totalSessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });

  s.paused = !s.paused;
  res.json({ success: true, paused: s.paused });
});

app.delete('/api/delete/:id', (req, res) => {
  totalSessions.delete(req.params.id);
  res.json({ success: true });
});

/* =========================
   SUBMIT
========================= */
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'missing fields' });
  }

  const sessionId = Date.now().toString();

  // 🔥 ALWAYS CREATE SESSION FIRST (FIXED CORE ISSUE)
  totalSessions.set(sessionId, {
    id: sessionId,
    url,
    count: 0,
    target: parseInt(amount),
    type,
    reaction: reaction || 'like',
    paused: false,
    error: null,
    reacted: false
  });

  console.log(`🎯 NEW SESSION: ${type} → ${url}`);

  try {
    const postId = await getPostID(url);
    if (!postId) throw new Error('invalid post id');

    const session = totalSessions.get(sessionId);
    session.postId = postId;

    if (type === 'share') {
      startGraphSharing(sessionId, cookie, url, postId, amount, interval);
    } else {
      startSmartReact(sessionId, cookie, url, postId, amount, interval, reaction);
    }

    res.json({ success: true, sessionId, postId });

  } catch (e) {
    console.log('❌ submit error:', e.message);
    totalSessions.get(sessionId).error = e.message;
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   SMART REACT (MERGED CORE)
========================= */
async function startSmartReact(sessionId, cookie, url, postId, amount, interval, reactionType) {
  const session = totalSessions.get(sessionId);

  let hasReacted = false;

  try {
    const cUser = cookie.match(/c_user=(\d+)/)?.[1];

    // METHOD 1 (GRAPHQL STYLE - your Franky part simplified but kept)
    try {
      const res = await axios.post(
        'https://m.facebook.com/ajax/ufi/like.php',
        `story_id=${postId}&__user=${cUser}`,
        { headers: { Cookie: cookie } }
      );

      if (res.status === 200) hasReacted = true;
    } catch {}

    // METHOD 2 (CHEERIO PICKER fallback)
    if (!hasReacted) {
      const page = await axios.get(`https://m.facebook.com/${postId}`, {
        headers: { Cookie: cookie }
      });

      const $ = cheerio.load(page.data);
      const link = $('a[href*="reaction"]').first().attr('href');

      if (link) {
        await axios.get(`https://m.facebook.com${link}`, {
          headers: { Cookie: cookie }
        });
        hasReacted = true;
      }
    }

    session.reacted = hasReacted;
    if (hasReacted) session.count = 1;

    console.log(`🎯 React result: ${hasReacted}`);

    const remaining = Math.max(0, amount - (hasReacted ? 1 : 0));

    if (remaining > 0) {
      startGraphSharing(sessionId, cookie, url, postId, remaining, interval);
    }

  } catch (e) {
    session.error = e.message;
  }
}

/* =========================
   GRAPH SHARING (STABLE FIXED)
========================= */
function startGraphSharing(sessionId, cookie, url, postId, target, interval) {
  const session = totalSessions.get(sessionId);

  let count = 0;

  const timer = setInterval(async () => {
    const s = totalSessions.get(sessionId);

    if (!s || s.paused || count >= target) {
      clearInterval(timer);
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/me/feed?link=${url}&published=0`,
        {},
        { headers: { Cookie: cookie } }
      );

      count++;
      s.count = count;

      console.log(`📤 SHARE ${count}/${target}`);

    } catch (e) {
      s.error = e.message;
    }

  }, interval * 1000);
}

/* =========================
   POST ID
========================= */
async function getPostID(url) {
  const match = url.match(/(\d+)/);
  return match ? match[1] : null;
}

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔥 Sessions enabled`);
});
