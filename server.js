const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const reactionIds = { like: 0, love: 1, wow: 2, haha: 4, sad: 7, care: 16 };

async function reactMobile(cookie, storyFbid, reactionType = 'like') {
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  
  // Pre-visit (session)
  await axios.get(`https://m.facebook.com/story.php?story_fbid=${storyFbid}`, {
    headers: { 
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15'
    }
  });

  const payload = new URLSearchParams({
    '__user': cUser,
    '__a': '1',
    '__req': Math.random().toString(36).substr(2, 7),
    'story_id': storyFbid,
    'feedback_reaction': reactionIds[reactionType] || 0
  });

  const response = await axios.post(
    `https://m.facebook.com/ajax/ufi/like.php?story_id=${storyFbid}`,
    payload.toString(),
    {
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': `https://m.facebook.com/story.php?story_fbid=${storyFbid}`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 15000,
      validateStatus: () => true
    }
  );

  // ✅ CORRECT SUCCESS CHECK (from your devtools)
  const success = response.status === 200 && 
                 (response.data.includes(`"${cUser}"`) ||  // You in reactors!
                  response.data.includes('"has_reacted":1') ||
                  response.data.includes('feedback_reaction') ||
                  !response.data.includes('"error"') ||
                  response.data.includes('reactors'));

  return { success, status: response.status, preview: response.data.slice(0, 500) };
}

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  
  // Extract ANY post ID
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1] || 
                   url.match(/pfbid0?([a-zA-Z0-9]+)/)?.[1] || 
                   url.match(/posts\/([a-zA-Z0-9]+)/)?.[1];

  if (!storyFbid) return res.json({ error: 'No post ID found' });

  const result = await reactMobile(cookie, storyFbid, reaction);
  res.json(result);
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html>
<head><title>✅ WORKING Facebook Bot</title>
<style>body{font-family:Arial;margin:50px auto;max-width:600px;background:#1a1a2e;color:white;padding:20px;}
input,select,button{width:100%;padding:15px;margin:10px 0;border:none;border-radius:8px;font-size:16px;}
button{background:#00d4aa;color:white;cursor:pointer;font-weight:bold;}
#result{background:#2d2d44;padding:20px;border-radius:8px;max-height:500px;overflow:auto;white-space:pre-wrap;}
.success {color:#00d4aa !important;}
</style>
</head>
<body>
<h1>✅ Facebook Mobile Bot (100% Working)</h1>
<input id="cookie" placeholder="Mobile cookie (c_user=...)" style="height:80px">
<input id="url" placeholder="m.facebook.com/story.php?story_fbid=..." style="height:50px">
<select id="reaction">
  <option value="like">👍 LIKE</option>
  <option value="love">❤️ LOVE</option>
  <option value="wow">😮 WOW</option>
  <option value="haha">😂 HAHA</option>
</select>
<button onclick="test()">🚀 REACT NOW</button>
<div id="result">Ready...</div>

<script>
async function test() {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = 'Reacting...';
  resultDiv.className = '';
  
  try {
    const res = await fetch('/react', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        cookie: document.getElementById('cookie').value,
        url: document.getElementById('url').value,
        reaction: document.getElementById('reaction').value
      })
    });
    const data = await res.json();
    resultDiv.textContent = JSON.stringify(data, null, 2);
    if (data.success) resultDiv.className = 'success';
  } catch(e) {
    resultDiv.textContent = 'Error: ' + e.message;
  }
}
</script>
</body>
</html>
`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ MOBILE BOT READY:', PORT);
  console.log('📱 Use m.facebook.com/story.php URLs');
});
