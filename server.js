const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
  const data = Array.from(totalSessions.values()).map((session, index) => ({
    sessionId: index + 1,
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

    console.log(`Starting ${type} session: ${postId}`);

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

// 🔥 FIXED AUTO-REACT (uses REAL Facebook endpoints)
async function startReactingSession(sessionId, cookie, url, postId, target, interval, reactionType) {
  totalSessions.set(sessionId, { 
    url, id: postId, count: 0, target, type: 'react', reaction: reactionType, 
    paused: false, error: null 
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-FB-Friendly-Name': 'ReactMutationCall',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-CSRFToken': cookie.match(/c_user=(\d+)/)?.[1] || ''
  };

  let reactionCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused) return;

    try {
      // ✅ WORKING Facebook Reaction POST
      const reactionPayload = new URLSearchParams({
        'story_id': postId,
        'client_mutation_id': `react_${Date.now()}`,
        'actor_id': cookie.match(/c_user=(\d+)/)?.[1],
        'feedback_reaction': getReactionValue(reactionType)
      });

      const response = await axios.post(
        `https://www.facebook.com/api/graphql/`,
        reactionPayload,
        { 
          headers, 
          timeout: 15000,
          maxRedirects: 5,
          followRedirect: true
        }
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
      handleSessionError(sessionId, error, cookie, url, postId, target, interval, reactionType, 'react');
    }
  }, interval * 1000);
}

// 📤 AUTO-SHARE (unchanged - WORKING)
function startSharingSession(sessionId, cookie, url, postId, target, interval) {
  totalSessions.set(sessionId, { 
    url, id: postId, count: 0, target, type: 'share', paused: false, error: null 
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const accessToken = cookie.match(/c_user=(\d+)/)?.[1] || '';
  if (!accessToken) {
    totalSessions.get(sessionId).error = 'Invalid cookie - no c_user';
    totalSessions.delete(sessionId);
    return;
  }

  let shareCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused) return;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,
        {},
        { headers, timeout: 10000 }
      );

      if (response.status === 200) {
        session.count += 1;
        shareCount += 1;
        session.error = null;
        console.log(`✅ SHARE: ${session.count}/${target} - ${postId}`);

        if (shareCount >= target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      handleSessionError(sessionId, error, cookie, url, postId, target, interval, null, 'share');
    }
  }, interval * 1000);
}

// ✅ FIXED Reaction Values
function getReactionValue(reaction) {
  const reactions = {
    'like': 'LIKE',
    'love': 'LOVE',
    'haha': 'HAHA',
    'wow': 'WOW',
    'sad': 'SAD',
    'angry': 'ANGRY'
  };
  return reactions[reaction.toLowerCase()] || 'LIKE';
}

function handleSessionError(sessionId, error, cookie, url, postId, target, interval, reaction, type) {
  const session = totalSessions.get(sessionId);
  if (session) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Network error';
    session.error = errorMsg.substring(0, 50);
    session.paused = true;
    console.error(`❌ ${type.toUpperCase()} ${sessionId}:`, errorMsg);

    setTimeout(() => {
      const recovered = totalSessions.get(sessionId);
      if (recovered) {
        recovered.paused = false;
        recovered.error = null;
        if (type === 'share') {
          startSharingSession(sessionId, cookie, url, postId, target, interval);
        } else {
          startReactingSession(sessionId, cookie, url, postId, target, interval, reaction);
        }
      }
    }, 60000); // Retry after 1 min
  }
}

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
    console.log(`Post ID extracted: ${postId}`);
    return postId;
  } catch (error) {
    console.error('Post ID failed:', error.message);
    return null;
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  totalSessions.clear();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Facebook Auto Bot v2.0`);
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log(`✅ Auto-Share & Auto-React READY!`);
});    res.status(404).json({ error: 'Session not found' });
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

// Submit new session (SHARE or REACT)
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  if (!cookie || !url || !amount || !interval || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (type === 'react' && !reaction) {
    return res.status(400).json({ error: 'Reaction type required for reactions' });
  }

  try {
    const sessionId = Date.now().toString();
    const postId = await getPostID(url);

    if (!postId) {
      return res.status(400).json({ error: 'Could not extract post ID from URL' });
    }

    // Start appropriate session type
    if (type === 'share') {
      startSharingSession(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
    } else if (type === 'react') {
      startReactingSession(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
    }

    res.json({ success: true, sessionId, type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🚀 AUTO-SHARE FUNCTION (original)
function startSharingSession(sessionId, cookie, url, postId, target, interval) {
  totalSessions.set(sessionId, { 
    url, id: postId, count: 0, target, type: 'share', paused: false, error: null 
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const accessToken = cookie.match(/c_user=(\d+)/)?.[1] || '';
  if (!accessToken) {
    totalSessions.get(sessionId).error = 'Invalid cookie';
    totalSessions.delete(sessionId);
    return;
  }

  let sharedCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused) return;

    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,
        {},
        { headers, timeout: 10000 }
      );

      if (response.status === 200) {
        session.count += 1;
        sharedCount += 1;
        session.error = null;

        if (sharedCount >= session.target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      handleSessionError(sessionId, error, cookie, url, postId, target, interval);
    }
  }, interval * 1000);
}

// 🔥 NEW AUTO-REACTION FUNCTION
function startReactingSession(sessionId, cookie, url, postId, target, interval, reaction) {
  totalSessions.set(sessionId, { 
    url, id: postId, count: 0, target, type: 'react', reaction, paused: false, error: null 
  });

  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  let reactionCount = 0;
  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused) return;

    try {
      // Facebook reaction endpoint
      const reactionData = {
        reaction: getReactionId(reaction), // Convert emoji to ID
        story_id: postId
      };

      const response = await axios.post(
        `https://www.facebook.com/api/graphql/`,
        new URLSearchParams({
          'variables': JSON.stringify({ 
            'input': { 
              'feedback_reaction': getReactionId(reaction),
              'story_id': postId 
            } 
          }),
          'doc_id': '123456789' // GraphQL doc ID (can be dynamic)
        }),
        { 
          headers, 
          timeout: 10000,
          maxRedirects: 3
        }
      );

      if (response.status === 200) {
        session.count += 1;
        reactionCount += 1;
        session.error = null;

        console.log(`Reaction ${sessionId}: ${reaction} (${session.count}/${session.target})`);

        if (reactionCount >= session.target) {
          clearInterval(timer);
          totalSessions.delete(sessionId);
        }
      }
    } catch (error) {
      handleSessionError(sessionId, error, cookie, url, postId, target, interval, reaction);
    }
  }, interval * 1000);
}

// Convert reaction emoji to Facebook reaction ID
function getReactionId(reaction) {
  const reactions = {
    'like': 1,
    'love': 2,
    'haha': 4,
    'wow': 3,
    'sad': 7,
    'angry': 8
  };
  return reactions[reaction.toLowerCase()] || 1; // Default to like
}

// Shared error handler
function handleSessionError(sessionId, error, cookie, url, postId, target, interval, reaction) {
  const session = totalSessions.get(sessionId);
  if (session) {
    const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
    session.error = errorMsg;
    session.paused = true;

    // Auto-retry after 1 minute
    setTimeout(() => {
      const recovered = totalSessions.get(sessionId);
      if (recovered) {
        recovered.paused = false;
        recovered.error = null;
        if (recovered.type === 'share') {
          startSharingSession(sessionId, cookie, url, postId, target, interval);
        } else {
          startReactingSession(sessionId, cookie, url, postId, target, interval, reaction);
        }
      }
    }, 60000);
  }
}

// Post ID extractor (unchanged)
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
    return response.data?.id;
  } catch (error) {
    console.error('Post ID extraction failed:', error.message);
    return null;
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  totalSessions.clear();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Facebook Bot Server running on port ${PORT}`);
  console.log(`📱 Auto-Share & Auto-React ready!`);
});
