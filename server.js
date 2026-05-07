const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// 🔥 SIMPLIFIED + DEBUG MODE
async function testReact(cookie, postIdFull, type = 'react') {
  console.log('\n🔍 DEBUG MODE:', type.toUpperCase(), '| Post:', postIdFull);
  
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  console.log('👤 User ID:', cUser);
  
  // Test 1: Basic page access
  try {
    const pageRes = await axios.get(`https://www.facebook.com/${postIdFull}`, {
      headers: { 
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('✅ Page access OK:', pageRes.status);
  } catch (e) {
    console.log('❌ Page access FAILED:', e.response?.status);
    return false;
  }

  // Test 2: SIMPLIFIED LIKE (proven working endpoint)
  const likePayload = new URLSearchParams({
    '__user': cUser,
    '__a': '1',
    'story_id': postIdFull,
    '__req': 'src',
    'dpr': '1'
  });

  try {
    const likeRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/like.php?story_id=${postIdFull}`,
      likePayload.toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `https://www.facebook.com/${postIdFull}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'X-FB-Friendly-Name': 'UfiLikeMutation'
        },
        timeout: 10000
      }
    );

    console.log('👍 LIKE Status:', likeRes.status);
    console.log('👍 LIKE Response (300 chars):', likeRes.data.slice(0, 300));
    
    const likeSuccess = likeRes.status === 200 && 
                       (likeRes.data.includes('Unlike') || 
                        likeRes.data.includes('removePreview') ||
                        likeRes.data.includes('feedback_reaction'));
    
    console.log('👍 LIKE SUCCESS:', likeSuccess);
    return likeSuccess;
  } catch (error) {
    console.log('❌ LIKE ERROR:', error.response?.status, error.message);
    console.log('❌ LIKE Response:', error.response?.data?.slice(0, 300));
    return false;
  }
}

async function testShare(cookie, postIdFull) {
  console.log('\n📤 SHARE TEST | Post:', postIdFull);
  
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  
  // Simple mobile share (most reliable)
  try {
    const shareRes = await axios.get(
      `https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://www.facebook.com/${postIdFull}`)}`,
      {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://m.facebook.com/${postIdFull}`
        },
        timeout: 10000
      }
    );

    console.log('📤 SHARE Status:', shareRes.status);
    const shareSuccess = shareRes.status === 200;
    console.log('📤 SHARE SUCCESS:', shareSuccess);
    return shareSuccess;
  } catch (error) {
    console.log('❌ SHARE ERROR:', error.response?.status);
    return false;
  }
}

// 🔥 MAIN API (DEBUG + SIMPLE)
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;
  
  console.log('\n🎯 DEBUG SESSION:', type, '| URL:', url);
  console.log('🍪 Cookie preview:', cookie.slice(0, 100) + '...');

  const postIdFull = getPostID(url);
  if (!postIdFull) {
    return res.status(400).json({ error: '❌ Invalid post URL' });
  }

  console.log('📄 Full Post ID:', postIdFull);

  // SINGLE TEST (not loop)
  const success = type === 'share' 
    ? await testShare(cookie, postIdFull)
    : await testReact(cookie, postIdFull, reaction);

  res.json({ 
    success,
    postId: postIdFull,
    type,
    message: success ? `✅ ${type.toUpperCase()} WORKS!` : `❌ ${type.toUpperCase()} FAILED - Check console`
  });
});

function getPostID(url) {
  // Exact match for your post
  const pfbidMatch = url.match(/story_fbid=pfbid0([a-zA-Z0-9]+)/);
  if (pfbidMatch) return `pfbid0${pfbidMatch[1]}`;
  
  const patterns = [/story_fbid=([^&]+)/, /pfbid=([^&]+)/, /posts?\/([a-zA-Z0-9]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

app.get('/total', (req, res) => res.json({ debug: 'Use POST /api/submit for testing' }));
app.get('/', (req, res) => {
  res.send(`
    <h1>🔍 DEBUG BOT</h1>
    <form id="testForm">
      <input id="cookie" placeholder="Full cookie" style="width:100%;height:60px"><br><br>
      <input id="url" placeholder="Post URL" style="width:100%"><br><br>
      <select id="type"><option value="react">React 👍</option><option value="share">Share 📤</option></select>
      <button type="button" onclick="test()">TEST (1x)</button>
    </form>
    <pre id="log"></pre>
    <script>
      async function test() {
        const data = {
          cookie: document.getElementById('cookie').value,
          url: document.getElementById('url').value,
          type: document.getElementById('type').value
        };
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        });
        const result = await res.json();
        document.getElementById('log').textContent = JSON.stringify(result, null, 2);
        console.log(result);
      }
    </script>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🔍 DEBUG BOT http://localhost:${PORT}`);
  console.log(`📝 Check console for DETAILED responses`);
});
