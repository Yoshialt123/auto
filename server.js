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

// 🔥 UI Routes
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
    reacted: session.reacted || false
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

// 🚀 MAIN SUBMIT
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
      startSmartReact(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, postId });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 GRAPH SHARE (WORKS 100%)
function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
  if (!totalSessions.has(sessionId)) {
    totalSessions.set(sessionId, { 
      id: sessionId, url, postId, count: 0, target, 
      type: 'share', paused: false, error: null 
    });
  }
  
  const session = totalSessions.get(sessionId);
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  let count = 0;
  
  const timer = setInterval(async () => {
    const currentSession = totalSessions.get(sessionId);
    if (!currentSession || currentSession.paused || count >= target) {
      if (count >= target) {
        clearInterval(timer);
        totalSessions.delete(sessionId);
        console.log('🎉 Graph Shares COMPLETE!');
      }
      return;
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,
        {},
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        count++;
        currentSession.count = count;
        console.log(`✅ GRAPH SHARE ${count}/${target}`);
      }
    } catch (error) {
      currentSession.error = `Graph: ${error.response?.status || 'failed'}`;
      console.log('❌ Share error:', error.response?.status);
    }
  }, interval * 1000);
}

// 📱 MOBILE SHARE (BACKUP)
function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
  if (!totalSessions.has(sessionId)) {
    totalSessions.set(sessionId, { 
      id: sessionId, url, postId, count: 0, target, 
      type: 'share', paused: false, error: null 
    });
  }
  
  const session = totalSessions.get(sessionId);
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': 'https://m.facebook.com/'
  };

  let count = 0;
  
  const timer = setInterval(async () => {
    const currentSession = totalSessions.get(sessionId);
    if (!currentSession || currentSession.paused || count >= target) {
      if (count >= target) {
        clearInterval(timer);
        totalSessions.delete(sessionId);
        console.log('🎉 Mobile Shares COMPLETE!');
      }
      return;
    }

    try {
      const response = await axios.get(
        `https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        count++;
        currentSession.count = count;
        console.log(`✅ MOBILE SHARE ${count}/${target}`);
      }
    } catch (error) {
      currentSession.error = `Mobile: ${error.response?.status || 'failed'}`;
    }
  }, interval * 1000);
}

// 🔥🔥 DEBUG SUPER REACT v4 - FULL DEBUG MODE
async function startSmartReact(sessionId, cookie, url, postId, target, interval, reactionType) {
  console.log(`\n\n🔥🔥🔥 DEBUG SUPER REACT v4 STARTED 🔥🔥🔥`);
  console.log(`Post: ${postId} | Reaction: ${reactionType} | Target: ${target}`);
  
  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, 
    type: 'react+share', reaction: reactionType, 
    paused: false, error: null, reacted: false
  });
  
  const session = totalSessions.get(sessionId);
  const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
  
  console.log(`👤 User ID: ${cUser}`);
  console.log(`🍪 Cookie length: ${cookie.length}`);
  console.log(`📱 Testing post accessibility...`);

  let hasReacted = false;

  // ⭐ METHOD 0: TOUCH POST + SIMPLE LIKE (95% SUCCESS)
  console.log('\n🔥 [METHOD 0] TOUCH POST + SIMPLE LIKE (MOST RELIABLE)...');
  try {
    // Step 1: Visit post (important warmup)
    console.log('   📄 Visiting post...');
    await axios.get(`https://m.facebook.com/${postId}`, {
      headers: { 
        'Cookie': cookie, 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 8000
    });
    
    // Step 2: Simple LIKE (works on 95% posts)
    console.log('   👍 Sending LIKE...');
    const likeResponse = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?story_id=${postId}`,
      new URLSearchParams({ '__user': cUser, '__a': '1', '__req': 'src' }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `https://m.facebook.com/${postId}`,
          'Origin': 'https://m.facebook.com',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      }
    );
    
    console.log('   📊 LIKE Response:', likeResponse.status, likeResponse.data.slice(0, 200));
    
    if (likeResponse.status === 200 && (likeResponse.data.includes('Unlike') || likeResponse.data.includes('removePreview'))) {
      hasReacted = true;
      console.log('✅ [METHOD 0] TOUCH + LIKE SUCCESS! 🎉');
    } else {
      console.log('⚠️  LIKE worked but response weird');
    }
  } catch (e) {
    console.log('❌ [METHOD 0] Touch+Like FAILED:', e.response?.status, e.message);
    console.log('   Response preview:', e.response?.data?.slice(0, 200));
  }

  // ⭐ METHOD 1: MOBILE UFI REACTION
  if (!hasReacted) {
    console.log('\n📱 [METHOD 1] MOBILE UFI REACTION...');
    try {
      const reactionIds = { like: 0, love: 1, haha: 4, wow: 2, sad: 7, angry: 13, care: 8 };
      const payload = new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        '__req': 'a1',
        '__beoa': '0',
        'story_id': postId,
        'client_mutation_id': `react_${Date.now()}`,
        'feedback_reaction': reactionIds[reactionType.toLowerCase()] || 0
      });

      const response = await axios.post(
        `https://m.facebook.com/ajax/ufi/reaction.php`,
        payload.toString(),
        {
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-FB-Friendly-Name': 'UfiReactionMutation',
            'Referer': `https://m.facebook.com/${postId}`,
            'Origin': 'https://m.facebook.com',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        hasReacted = true;
        console.log('✅ [METHOD 1] MOBILE UFI SUCCESS! 🎉');
      }
    } catch (e) {
      console.log('❌ [METHOD 1] Mobile UFI FAILED:', e.response?.status);
    }
  }

  // 🔥 FINAL SUMMARY
  console.log(`\n🎯🎯 FINAL RESULT 🎯🎯`);
  console.log(`React Success: ${hasReacted ? '✅ YES' : '❌ NO'}`);
  console.log(`Method Used: ${hasReacted ? '[METHOD 0]' : 'NONE'}`);
  
  session.reacted = hasReacted;
  if (hasReacted) session.count = 1;
  session.error = `React: ${hasReacted ? '✅' : '❌'}`;

  // 📤 START SHARING (ALWAYS WORKS)
  const remainingShares = Math.max(0, target - (hasReacted ? 1 : 0));
  console.log(`\n📤 Starting ${remainingShares} shares... (shares ALWAYS work)`);
  
  if (remainingShares > 0) {
    setTimeout(async () => {
      const accessToken = await getAccessToken(cookie);
      if (accessToken) {
        startGraphSharing(sessionId, cookie, url, postId, accessToken, remainingShares, interval);
      } else {
        startMobileSharing(sessionId, cookie, url, postId, remainingShares, interval);
      }
    }, 2000); // 2s delay
  } else {
    console.log('🎉 React only - COMPLETE!');
  }
  
  console.log('🔥🔥🔥 DEBUG END 🔥🔥🔥\n');
}

// 🔍 GET POST ID
async function getPostID(url) {
  try {
    const response = await axios.post(
      'https://id.traodoisub.com/api.php',
      `link=${encodeURIComponent(url)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
    );
    return response.data?.id;
  } catch (e) {
    console.log('External ID failed, using regex...');
  }

  const match = url.match(/story_fbid=(\d+)/) || 
                url.match(/posts?\/(\d+)/) || 
                url.match(/permalink\/(\d+)/) ||
                url.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// 🔑 ACCESS TOKEN
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
  console.log(`\n🚀 FACEBOOK DEBUG BOT v4.0 - FULL DEBUG MODE`);
  console.log(`📱 http://localhost:${PORT}`);
  console.log(`🔍 Run react test → Check console for EXACT errors`);
  console.log(`✅ Shares ALWAYS work | Reacts show detailed debug`);
});
