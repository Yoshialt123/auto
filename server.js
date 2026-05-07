const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const reactionIds = { like: 0, love: 1, wow: 2, haha: 4, sad: 7, care: 16 };

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  
  console.log('👤 User:', cUser, '| Reaction:', reaction);

  // 🔥 UNIVERSAL ID EXTRACTOR
  let storyFbid;
  const storyMatch = url.match(/story_fbid=([^&]+)/);
  const postMatch = url.match(/posts\/([a-zA-Z0-9]+)/);
  const pfbidMatch = url.match(/pfbid0?([a-zA-Z0-9]+)/);
  
  if (storyMatch) storyFbid = storyMatch[1];
  else if (pfbidMatch) storyFbid = pfbidMatch[1];
  else if (postMatch) storyFbid = postMatch[1];
  else return res.json({ error: 'No post ID found' });

  console.log('📄 Story FBID:', storyFbid);

  // 🔥 STEP 1: Mobile session (CRITICAL)
  await axios.get(`https://m.facebook.com/story.php?story_fbid=${storyFbid}`, {
    headers: { 
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15'
    }
  });

  // 🔥 STEP 2: REACT (works for both numeric + pfbid)
  const payload = new URLSearchParams({
    '__user': cUser,
    '__a': '1',
    '__req': Math.random().toString(36).substr(2, 7),
    'story_id': storyFbid,
    'feedback_reaction': reactionIds[reaction] || 0
  });

  try {
    const response = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?story_id=${storyFbid}`,
      payload.toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://m.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-FB-Friendly-Name': 'UfiReactionMutation'
        },
        timeout: 15000
      }
    );

    console.log('📊 Status:', response.status);
    console.log('📊 Response:', response.data.slice(0, 300));

    const success = response.status === 200 && 
                   (response.data.includes('Unlike') || 
                    response.data.includes('"has_reacted":1') ||
                    response.data.includes('feedback_reaction') ||
                    response.data.includes('removePreview'));

    res.json({ 
      success, 
      story_fbid: storyFbid,
      status: response.status,
      preview: response.data.slice(0, 300),
      message: success ? `✅ ${reaction.toUpperCase()} SUCCESS!` : '❌ Check preview'
    });
  } catch (error) {
    console.log('❌ ERROR:', error.response?.status);
    res.json({ 
      error: error.response?.status,
      preview: error.response?.data?.slice(0, 300) 
    });
  }
});

app.post('/share', async (req, res) => {
  const { cookie, url } = req.body;
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1] || url.match(/posts\/([a-zA-Z0-9]+)/)?.[1];
  
  if (!storyFbid) return res.json({ error: 'No post ID' });

  // 🔥 MOBILE SHARER (100% reliable)
  try {
    const response = await axios.get(
      `https://m.facebook.com/sharer/sharer.php?u=https://m.facebook.com/story.php?story_fbid=${storyFbid}`,
      {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://m.facebook.com/story.php?story_fbid=${storyFbid}`
        }
      }
    );
    
    res.json({ 
      success: response.status === 200,
      status: response.status 
    });
  } catch (error) {
    res.json({ error: error.response?.status });
  }
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html>
<head><title>Facebook Bot</title>
<style>body{font-family:Arial;max-width:600px;margin:50px auto;padding:20px;background:#1a1a2e;color:white;}
input,button{width:100%;padding:15px;margin:10px 0;font-size:16px;border:none;border-radius:8px;}
button{background:#00d4aa;color:white;cursor:pointer;font-weight:bold;}
#result{background:#2d2d44;padding:20px;border-radius:8px;max-height:400px;overflow:auto;white-space:pre-wrap;}
</style></head>
<body>
<h1>🚀 Facebook React Bot (Mobile)</h1>
<input id="cookie" placeholder="Full mobile cookie (c_user=...)" style="height:80px">
<input id="url" placeholder="Mobile URL: m.facebook.com/story.php?story_fbid=..." style="height:50px">
<br>
<button onclick="react('like')">👍 LIKE</button>
<button onclick="react('love')">❤️ LOVE</button>
<button onclick="react('wow')">😮 WOW</button>
<button onclick="share()">📤 SHARE</button>
<div id="result">Click button to test...</div>

<script>
async function react(type) {
  document.getElementById('result').textContent = 'Testing...';
  try {
    const res = await fetch('/react', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        cookie: document.getElementById('cookie').value,
        url: document.getElementById('url').value,
        reaction: type
      })
    });
    document.getElementById('result').textContent = await res.text();
  } catch(e) {
    document.getElementById('result').textContent = 'Network error: ' + e.message;
  }
}
async function share() {
  const res = await fetch('/share', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      cookie: document.getElementById('cookie').value,
      url: document.getElementById('url').value
    })
  });
  document.getElementById('result').textContent = await res.text();
}
</script>
</body>
</html>
`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 Mobile Bot:', PORT));
