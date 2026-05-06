const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all sessions
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

// Pause/Resume session
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

// Submit new session
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sessionId = Date.now().toString();
    const postId = await getPostID(url);

    if (!postId) {
      return res.status(400).json({ error: 'Could not extract post ID from URL' });
    }

    // Start session
    if (type === 'share') {
      startSharingSession(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
    } else if (type === 'react') {
      startReactingSession(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, type, postId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ CORRECTED SHARING FUNCTION
function startSharingSession(sessionId, cookie, url, postId, target, interval) {
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

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://www.facebook.com/'
  };

  let shareCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || session.count >= session.target) return;

    try {
      // ✅ CORRECT Facebook Share endpoint
      const sharePayload = new URLSearchParams({
        'target_id': postId,
        'share_type': 'STORY',
        'client_mutation_id': `share_${Date.now()}`
      });

      const response = await axios.post(
        'https://www.facebook.com/api/graphql/',
        sharePayload,
        { headers, timeout: 15000 }
      );

      if (response.status === 200) {
        session.count += 1;
        shareCount += 1;
        session.error = null;
        console.log(`✅ SHARE ${session.count}/${target} - ${postId}`);
        
        if (shareCount >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
          console.log('🎉 Share session completed!');
        }
      }
    } catch (error) {
      handleSessionError(sessionId, error, cookie, url, postId, target, interval, null, 'share', timer);
    }
  }, interval * 1000);
}

// ✅ CORRECTED REACTION FUNCTION  
async function startReactingSession(sessionId, cookie, url, postId, target, interval, reactionType) {
  totalSessions.set(sessionId, { 
    id: sessionId,
    url, 
    postId, 
    count: 0, 
    target, 
    type: 'react', 
    reaction: reactionType,
    paused: false, 
    error: null 
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-FB-Friendly-Name': 'ReactMutationCall',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://www.facebook.com/'
  };

  let reactionCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || session.count >= session.target) return;

    try {
      // ✅ CORRECT Facebook Reaction payload
      const reactionPayload = new URLSearchParams({
        'story_id': postId,
        'client_mutation_id': `react_${Date.now()}`,
        'actor_id': cookie.match(/c_user=(\d+)/)?.[1] || '',
        'feedback_reaction': getReactionValue(reactionType)
      });

      const response = await axios.post(
        'https://www.facebook.com/api/graphql/',
        reactionPayload,
        { headers, timeout: 15000 }
      );

      if (response.status === 200 || response.status === 302) {
        session.count += 1;
        reactionCount += 1;
        session.error = null;
        console.log(`✅ REACT ${reactionType}: ${session.count}/${target} - ${postId}`);
        
        if (reactionCount >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
          console.log('🎉 Reaction session completed!');
        }
      }
    } catch (error) {
      handleSessionError(sessionId, error, cookie, url, postId, target, interval, reactionType, 'react', timer);
    }
  }, interval * 1000);
}

// Reaction mapping
function getReactionValue(reaction) {
  const reactions = {
    'like': 0,
    'love': 1, 
    'haha': 4,
    'wow': 2,
    'sad': 3,
    'angry': 5
  };
  return reactions[reaction.toLowerCase()] || 0;
}

// Error handler with timer cleanup
function handleSessionError(sessionId, error, cookie, url, postId, target, interval, reaction, type, timer) {
  const session = totalSessions.get(sessionId);
  if (session) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Network error';
    session.error = errorMsg.substring(0, 50);
    session.paused = true;
    console.error(`❌ ${type.toUpperCase()} ERROR ${sessionId}:`, errorMsg);

    // Auto-retry after 60 seconds
    setTimeout(() => {
      const recovered = totalSessions.get(sessionId);
      if (recovered && !timer._destroyed) {
        recovered.paused = false;
        recovered.error = null;
        if (type === 'share') {
          startSharingSession(sessionId, cookie, url, postId, target, interval);
        } else {
          startReactingSession(sessionId, cookie, url, postId, target, interval, reaction);
        }
      }
    }, 60000);
  }
}

// Post ID extractor
async function getPostID(url) {
  try {
    const response = await axios.post(
      'https://id.traodoisub.com/api.php',
      `link=${encodeURIComponent(url)}`,
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000 
      }
    );
    const postId = response.data?.id;
    console.log(`✅ Post ID extracted: ${postId}`);
    return postId;
  } catch (error) {
    console.error('❌ Post ID extraction failed:', error.message);
    return null;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  totalSessions.clear();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Facebook Auto Bot v2.1 FIXED`);
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log(`✅ Auto-Share 📤 & Auto-React ❤️ READY!`);
});
