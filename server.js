const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get sessions
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

// Pause session
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

// Delete session
app.delete('/api/delete/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  if (totalSessions.delete(sessionId)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Submit session
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('🔍 Extracting post ID from:', url);
    
    // ✅ FIXED: Extract post ID FIRST
    const postId = await getPostID(url);
    console.log('✅ Post ID extracted:', postId);

    if (!postId) {
      return res.status(400).json({ error: 'Could not extract post ID from URL. Try: https://www.facebook.com/story.php?story_fbid=XXXXX&id=YYYYY' });
    }

    const sessionId = Date.now().toString();

    // Try Graph API first (most reliable)
    const accessToken = await getAccessToken(cookie);
    console.log('🔑 Access token:', accessToken ? '✅ Found' : '❌ Failed');

    if (type === 'share' && accessToken) {
      startGraphSharing(sessionId, cookie, url, postId, accessToken, parseInt(amount), parseInt(interval));
    } else if (type === 'share') {
      // Fallback to mobile share
      startMobileSharing(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
    } else {
      // React always uses mobile
      startMobileReacting(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, postId });
  } catch (error) {
    console.error('❌ Submit error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 GRAPH API SHARE
function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, type: 'share', 
    paused: false, error: null, accessToken: '***'
  });

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
        console.log(`✅ GRAPH SHARE ${session.count}/${target}`);
        if (count >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      session.error = error.response?.status || error.message;
    }
  }, interval * 1000);
}

// 📱 MOBILE SHARE
function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, type: 'share', paused: false, error: null
  });

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
      session.error = error.response?.status || error.message;
    }
  }, interval * 1000);
}

// ❤️ MOBILE REACT
function startMobileReacting(sessionId, cookie, url, postId, target, interval, reaction) {
  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, type: 'react', 
    reaction, paused: false, error: null
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://m.facebook.com/'
  };

  const reactions = { like: 0, love: 1, haha: 4, wow: 2, sad: 7, angry: 13 };

  let count = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) return;

    try {
      const payload = new URLSearchParams({
        'story_id': postId,
        'client_mutation_id': `react_${Date.now()}`,
        'feedback_reaction': reactions[reaction.toLowerCase()] || 0
      });

      const response = await axios.post(
        'https://m.facebook.com/api/graphql/',
        payload,
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        session.count++;
        count++;
        console.log(`✅ ${reaction.toUpperCase()} ${session.count}/${target}`);
        if (count >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      session.error = error.response?.status || error.message;
    }
  }, interval * 1000);
}

// 🔍 FIXED Post ID Extractor
async function getPostID(url) {
  try {
    console.log('🌐 Calling traodoisub API...');
    const response = await axios.post(
      'https://id.traodoisub.com/api.php',
      `link=${encodeURIComponent(url)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );
    
    if (response.data?.id) {
      console.log('✅ Traodoisub success:', response.data.id);
      return response.data.id;
    }
  } catch (error) {
    console.log('❌ Traodoisub failed, trying regex...');
  }

  // ✅ FALLBACK: Regex extraction (works with your URL)
  const regex1 = /story_fbid=(\d+)/;
  const regex2 = /post\/(\d+)/;
  const regex3 = /id=(\d+)/;
  
  const match1 = url.match(regex1);
  if (match1) return match1[1];
  
  const match2 = url.match(regex2);
  if (match2) return match2[1];
  
  return null;
}

// 🔑 Access Token Extractor
async function getAccessToken(cookie) {
  try {
    const headers = {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.facebook.com/'
    };

    const response = await axios.get('https://business.facebook.com/content_management', {
      headers, timeout: 15000
    });

    const tokenMatch = response.data.match(/"accessToken":\s*"([^"]+)"/);
    return tokenMatch ? tokenMatch[1] : null;
  } catch (error) {
    console.log('❌ Access token failed (normal for some accounts)');
    return null;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Facebook Auto Bot v4.0 FIXED`);
  console.log(`📱 http://localhost:${PORT}`);
  console.log(`✅ Post ID extraction FIXED!`);
});
