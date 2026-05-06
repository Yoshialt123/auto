const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// ... ALL YOUR FANCY UI ROUTES (unchanged)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  const data = Array.from(totalSessions.values()).map((session, index) => ({
    sessionId: session.id,
    url: session.url,
    count: session.count,
    target: session.target,
    type: session.type,
    reaction: session.reaction || null,
    error: session.error || null,
    paused: session.paused || false,
  }));
  res.json(data);
});

app.post('/api/pause/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = totalSessions.get(sessionId);
  if (session) {
    session.paused = !session.paused;
    res.json({ success: true, paused: session.paused });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.delete('/api/delete/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  if (totalSessions.delete(sessionId)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// 🔥 GRAPH API SHARE (from your endpoint - FIXED for raw cookies)
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sessionId = Date.now().toString();
    const postId = await getPostID(url);
    
    if (!postId) {
      return res.status(400).json({ error: 'Could not extract post ID' });
    }

    const accessToken = await getAccessToken(cookie);
    if (!accessToken) {
      return res.status(400).json({ error: 'Could not get access token from cookie' });
    }

    console.log(`🚀 Starting ${type} with Graph API: ${postId}`);

    if (type === 'share') {
      startGraphSharing(sessionId, cookie, url, postId, accessToken, parseInt(amount), parseInt(interval));
    } else {
      // Fallback to mobile react for reactions
      startMobileReacting(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, postId, accessToken: '***HIDDEN***' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔥 GRAPH API SHARING (YOUR endpoint - fixed for raw cookies)
function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
  totalSessions.set(sessionId, {
    id: sessionId,
    url, postId, count: 0, target, type: 'share',
    paused: false, error: null, accessToken
  });

  const headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'connection': 'keep-alive',
    'cookie': cookie,
    'host': 'graph.facebook.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  let sharedCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || sharedCount >= target) return;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,
        {},
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        session.count++;
        sharedCount++;
        session.error = null;
        console.log(`✅ GRAPH SHARE ${session.count}/${target} → ${postId}`);
        
        if (sharedCount >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
          console.log('🎉 Graph Share COMPLETED!');
        }
      }
    } catch (error) {
      handleError(sessionId, error, 'GRAPH SHARE');
    }
  }, interval * 1000);
}

// 🔥 ACCESS TOKEN EXTRACTOR (from your endpoint)
async function getAccessToken(cookie) {
  try {
    const headers = {
      'authority': 'business.facebook.com',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'cookie': cookie,
      'referer': 'https://www.facebook.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await axios.get('https://business.facebook.com/content_management', {
      headers,
      timeout: 15000
    });

    // Extract token from HTML
    const $ = cheerio.load(response.data);
    const tokenMatch = response.data.match(/"accessToken":\s*"([^"]+)"/);
    return tokenMatch ? tokenMatch[1] : null;
  } catch (error) {
    console.error('Access token failed:', error.message);
    return null;
  }
}

// ... Include ALL mobile react function from previous code
function startMobileReacting(sessionId, cookie, url, postId, target, interval, reactionType) {
  // SAME as previous mobile react code
  // ... (copy from previous response)
}

// ... Include getPostID, handleError functions from previous code

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Facebook Auto Bot v3.5 GRAPH API ✅`);
  console.log(`📱 http://localhost:${PORT}`);
  console.log(`✅ Graph Share + Mobile React!`);
});
