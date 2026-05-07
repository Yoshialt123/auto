const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// 🔥 ALL REACTIONS SUPPORTED
const reactionIds = { 
  like: 0,      // 👍
  love: 1,      // ❤️
  wow: 2,       // 😮
  haha: 4,      // 😂
  sad: 7,       // 😢
  angry: 13,    // 😠
  care: 16      // 🥰
};

// 🔥 MAIN MOBILE REACT (ALL REACTIONS)
async function mobileReact(cookie, postId, reactionType = 'like') {
  const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
  if (!cUser) return false;

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': `https://m.facebook.com/story.php?story_fbid=${postId}`,
    'X-FB-Friendly-Name': 'UfiReactionMutation',
    'X-Requested-With': 'XMLHttpRequest'
  };

  const payload = new URLSearchParams({
    '__user': cUser,
    'story_id': postId,
    '__a': '1',
    '__req': Math.random().toString(36).substring(2, 7),
    '__hs': '19316.HYP:comet_pkg.2.1...',
    'dpr': '2',
    'client_mutation_id': `react_${Date.now()}`,
    'feedback_reaction': reactionIds[reactionType] || 0,
    '__ccg': 'EXCELLENT',
    '__rev': Date.now().toString()
  });

  try {
    const response = await axios.post(
      'https://m.facebook.com/ajax/ufi/reaction.php',
      payload.toString(),
      { headers, timeout: 12000, maxRedirects: 0 }
    );
    console.log(`✅ ${reactionType.toUpperCase()}: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    console.log(`⚠️ React ${reactionType}: ${error.response?.status || error.message}`);
    return false;
  }
}

// 🔥 SIMPLE LIKE (Fallback)
async function simpleLike(cookie, postId) {
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': `https://m.facebook.com/story.php?story_fbid=${postId}`
  };

  try {
    const response = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?story_id=${postId}`,
      new URLSearchParams({ like: 1 }),
      { headers, timeout: 8000 }
    );
    console.log(`✅ LIKE: ${response.status}`);
    return response.status === 200;
  } catch (error) {
    console.log(`⚠️ Like failed`);
    return false;
  }
}

// 🔥 POST ID EXTRACTOR
function getPostID(url) {
  console.log(`🔍 URL: ${url.substring(0, 60)}...`);
  const patterns = [
    /story_fbid=(\d+)/,
    /posts?[\/](\d+)/,
    /permalink[\/](\d+)/,
    /id=(\d+)/,
    /photo\.php\?fbid=(\d+)/,
    /pfbid=(\d+)/,
    /\/(\d{15,})/,
    /(\d{15,})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log(`✅ Post ID: ${match[1]}`);
      return match[1];
    }
  }
  console.log('❌ No Post ID');
  return null;
}

// 🔥 REACT ENGINE (All reactions + fallback)
async function startReact(sessionId, cookie, url, postId, target, interval, reactionType) {
  totalSessions.set(sessionId, {
    id: sessionId,
    url,
    postId,
    count: 0,
    target,
    type: 'react',
    reaction: reactionType,
    paused: false,
    error: null,
    reacted: false
  });

  let count = 0;
  let useSimpleLike = false;

  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) {
      if (count >= target) {
        clearInterval(timer);
        console.log(`🎉 ${reactionType.toUpperCase()} COMPLETE! ${count}/${target}`);
        totalSessions.delete(sessionId);
      }
      return;
    }

    let success = false;
    
    // Primary method: Mobile React (all reactions)
    if (!useSimpleLike) {
      success = await mobileReact(cookie, postId, reactionType);
    }
    
    // Fallback: Simple Like
    if (!success) {
      success = await simpleLike(cookie, postId);
      useSimpleLike = true;
    }
    
    if (success) {
      count++;
      session.count = count;
      session.reacted = true;
      session.error = null;
      console.log(`✅ ${reactionType.toUpperCase()} ${count}/${target}`);
    } else {
      session.error = 'Retrying...';
    }
  }, interval * 1000);
}

// 📱 MOBILE SHARE
function startMobileShare(sessionId, cookie, url, postId, target, interval) {
  totalSessions.set(sessionId, {
    id: sessionId,
    url,
    postId,
    count: 0,
    target,
    type: 'share',
    paused: false,
    error: null
  });

  let count = 0;
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': 'https://m.facebook.com/'
  };

  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) {
      if (count >= target) {
        clearInterval(timer);
        console.log('🎉 Shares COMPLETE!');
        totalSessions.delete(sessionId);
      }
      return;
    }

    try {
      await axios.get(`https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, 
        { headers, timeout: 10000 });
      count++;
      session.count = count;
      console.log(`✅ SHARE ${count}/${target}`);
    } catch(e) {
      session.error = 'Share retrying...';
    }
  }, interval * 1000);
}

// 🚀 MAIN API ENDPOINT
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  // Validation
  if (!cookie?.includes('c_user=') || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: '❌ Missing cookie or fields' });
  }

  try {
    const postId = getPostID(url);
    if (!postId) {
      return res.status(400).json({ error: '❌ Invalid Facebook post URL' });
    }

    const sessionId = Date.now().toString();
    console.log(`\n🎯 ${type.toUpperCase()} → ${postId}`);

    if (type === 'share') {
      startMobileShare(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
    } else {
      startReact(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction || 'like');
    }

    res.json({ success: true, sessionId, postId });

  } catch (error) {
    console.error('Submit error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 📋 UI ROUTES
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  res.json(Array.from(totalSessions.values()).map(session => ({
    sessionId: session.id,
    url: session.url,
    count: session.count,
    target: session.target,
    type: session.type,
    reaction: session.reaction || 'like',
    error: session.error || null,
    paused: session.paused || false,
    reacted: session.reacted || false
  })));
});

app.post('/api/pause/:sessionId', (req, res) => {
  const session = totalSessions.get(req.params.sessionId);
  if (session) {
    session.paused = !session.paused;
    res.json({ success: true, paused: session.paused });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.delete('/api/delete/:sessionId', (req, res) => {
  totalSessions.delete(req.params.sessionId);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n🚀 Facebook Auto Bot v13 - ALL REACTIONS ✅');
  console.log(`📱 Server running on http://localhost:${PORT}`);
  console.log('⭐ Works with REGULAR login cookies!');
  console.log('✅ Supports: like ❤️ love 😮 wow 😂 haha 😢 sad 😠 angry 🥰 care');
});
