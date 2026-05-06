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

const HYBRID_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br'
};

// ROUTES
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  const data = Array.from(totalSessions.values());
  res.json(data);
});

app.post('/api/pause/:sessionId', (req, res) => {
  const session = totalSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.paused = !session.paused;
  res.json({ success: true, paused: session.paused });
});

app.delete('/api/delete/:sessionId', (req, res) => {
  if (!totalSessions.delete(req.params.sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ success: true });
});

// MAIN
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log(`\n🎯 ${type.toUpperCase()}: ${url}`);

    const postId = await getPostID(url);
    if (!postId) {
      return res.status(400).json({ error: 'Could not extract post ID' });
    }

    const sessionId = Date.now().toString();
    console.log(`✅ Post ID: ${postId}`);

    if (type === 'share') {
      const token = await getAccessToken(cookie);
      if (token) {
        startGraphSharing(sessionId, cookie, url, postId, token, amount, interval);
      } else {
        startMobileSharing(sessionId, cookie, url, postId, amount, interval);
      }
    } else {
      startHybridReact(sessionId, cookie, url, postId, amount, interval, reaction || 'like');
    }

    res.json({ success: true, sessionId, postId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// HYBRID REACT
async function startHybridReact(sessionId, cookie, url, postId, target, interval, reactionType) {
  console.log(`\n🔥 HYBRID (${reactionType}) | ${postId}`);

  totalSessions.set(sessionId, {
    id: sessionId,
    url,
    postId,
    count: 0,
    target,
    type: 'react+share',
    paused: false,
    reacted: false
  });

  const session = totalSessions.get(sessionId);
  const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
  let hasReacted = false;

  try {
    await axios.get(`https://m.facebook.com/${postId}`, {
      headers: { Cookie: cookie }
    });
  } catch {}

  try {
    const likeRes = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?story_id=${postId}`,
      `__user=${cUser}&__a=1`,
      { headers: { Cookie: cookie } }
    );

    if (likeRes.status === 200) {
      hasReacted = true;
    }
  } catch {}

  console.log(`🎯 React: ${hasReacted ? 'YES' : 'NO'}`);
  session.reacted = hasReacted;

  const shares = Math.max(0, target - (hasReacted ? 1 : 0));
  console.log(`📤 Shares: ${shares}`);

  if (shares > 0) {
    setTimeout(async () => {
      const token = await getAccessToken(cookie);
      if (token) {
        startGraphSharing(sessionId, cookie, url, postId, token, shares, interval);
      } else {
        startMobileSharing(sessionId, cookie, url, postId, shares, interval);
      }
    }, 2000);
  }
}

// GRAPH SHARING
function startGraphSharing(sessionId, cookie, url, postId, token, target, interval) {
  let count = 0;

  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) {
      clearInterval(timer);
      return;
    }

    try {
      await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${token}`
      );

      count++;
      session.count = count;

      console.log(`✅ GRAPH ${count}/${target}`);
    } catch {}
  }, interval * 1000);
}

// MOBILE SHARING
function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
  let count = 0;

  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) {
      clearInterval(timer);
      return;
    }

    try {
      await axios.get(
        `https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        { headers: { Cookie: cookie } }
      );

      count++;
      session.count = count;

      console.log(`📱 MOBILE ${count}/${target}`);
    } catch {}
  }, interval * 1000);
}

// GET POST ID
async function getPostID(url) {
  try {
    const res = await axios.post(
      'https://id.traodoisub.com/api.php',
      `link=${encodeURIComponent(url)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (res.data?.id) return res.data.id;
  } catch {}

  const match = url.match(/(\d+)/);
  return match ? match[1] : null;
}

// ACCESS TOKEN
async function getAccessToken(cookie) {
  try {
    const res = await axios.get(
      'https://business.facebook.com/content_management',
      { headers: { Cookie: cookie } }
    );

    const match = res.data.match(/"accessToken":"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});
