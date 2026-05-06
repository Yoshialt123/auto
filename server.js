const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// 📋 All your UI routes (unchanged)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  const data = Array.from(totalSessions.values()).map(session => ({
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

// 🚀 Submit (React 1x + Share rest)
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
      const accessToken = await getAccessToken(cookie);
      if (accessToken) {
        startGraphSharing(sessionId, cookie, url, postId, accessToken, parseInt(amount), parseInt(interval));
      } else {
        startMobileSharing(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
      }
    } else {
      // 🔥 REACT: 1x max + share rest
      startSmartReact(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, postId });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 📤 GRAPH SHARE (Primary - WORKS BEST)
function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
  totalSessions.set(sessionId, { id: sessionId, url, postId, count: 0, target, type: 'share', paused: false, error: null });
  
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  let count = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) return;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,
        {},
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        session.count++;
        count++;
        console.log(`✅ SHARE ${session.count}/${target}`);
        if (count >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
          console.log('🎉 Shares COMPLETE!');
        }
      }
    } catch (error) {
      session.error = `Status: ${error.response?.status || 'failed'}`;
    }
  }, interval * 1000);
}

// 📱 MOBILE SHARE (Backup)
function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
  totalSessions.set(sessionId, { id: sessionId, url, postId, count: 0, target, type: 'share', paused: false, error: null });
  
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': 'https://m.facebook.com/'
  };

  let count = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) return;

    try {
      const response = await axios.get(
        `https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        session.count++;
        count++;
        console.log(`✅ MOBILE SHARE ${session.count}/${target}`);
        if (count >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      session.error = `Status: ${error.response?.status || 'failed'}`;
    }
  }, interval * 1000);
}

// ❤️ SMART REACT (1x max + share rest) - FIXED
async function startSmartReact(sessionId, cookie, url, postId, target, interval, reactionType) {
  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, type: 'react+share',
    reaction: reactionType, paused: false, error: null, reacted: false
  });

  const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
  let hasReacted = false;

  // 🔥 REACT PHASE (1x only) - Do it immediately
  try {
    const headers = {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `https://m.facebook.com/${postId}`
    };

    const reactionIds = { like: 0, love: 1, haha: 4, wow: 2, sad: 7, angry: 13 };
    const payload = new URLSearchParams({
      '__user': cUser,
      'story_id': postId,
      'client_mutation_id': `react_${Date.now()}`,
      'feedback_reaction': reactionIds[reactionType.toLowerCase()] || 0
    });

    const response = await axios.post(
      `https://m.facebook.com/ajax/ufi/reaction.php`,
      payload,
      { headers, timeout: 15000 }
    );

    if (response.status === 200) {
      const session = totalSessions.get(sessionId);
      if (session) {
        session.count = 1;
        session.reacted = true;
      }
      hasReacted = true;
      console.log(`✅ ${reactionType.toUpperCase()} (1/1) + ${target-1} shares...`);
    } else {
      console.log('⚠️ React failed/skipped, doing shares only...');
      hasReacted = true;
    }
  } catch (error) {
    console.log('❌ React failed, doing shares...');
    hasReacted = true;
  }

  // 🔥 SHARE PHASE (unlimited) - Start sharing immediately after react
  if (hasReacted && target > 1) {
    const session = totalSessions.get(sessionId);
    if (session) {
      session.type = 'react+share';
      session.error = `Reacted ✅ + Sharing 1/${target}`;
    }
    
    // Use Graph API sharing if possible
    const accessToken = await getAccessToken(cookie);
    if (accessToken) {
      startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval);
    } else {
      startMobileSharing(sessionId, cookie, url, postId, target, interval);
    }
  }
}

// 🔍 Post ID
async function getPostID(url) {
  try {
    const response = await axios.post(
      'https://id.traodoisub.com/api.php',
      `link=${encodeURIComponent(url)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );
    return response.data?.id;
  } catch (e) {}

  const match = url.match(/story_fbid=(\d+)/) || url.match(/post\/(\d+)/);
  return match ? match[1] : null;
}

// 🔑 Access Token
async function getAccessToken(cookie) {
  try {
    const response = await axios.get('https://business.facebook.com/content_management', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.facebook.com/'
      },
      timeout: 15000
    });
    const match = response.data.match(/"accessToken":\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Facebook Auto Bot v5.0 (React 1x + Share ∞)`);
  console.log(`📱 http://localhost:${PORT}`);
  console.log(`✅ React ONCE per account + Unlimited shares!`);
});
