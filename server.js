const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1];
  
  if (!cUser || !storyFbid) {
    return res.json({ error: 'Missing c_user or story_fbid' });
  }

  console.log(`Reacting ${reaction} | Post: ${storyFbid} | User: ${cUser}`);

  // 🔥 METHOD 1: Desktop UFI (most reliable)
  try {
    const desktopRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/like.php?story_id=${storyFbid}`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `https://www.facebook.com/${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (desktopRes.status === 200) {
      const success = desktopRes.data.includes('Unlike') || 
                     desktopRes.data.includes('removePreview');
      return res.json({ 
        success, 
        method: 'desktop_ufi',
        status: desktopRes.status,
        preview: desktopRes.data.slice(0, 300)
      });
    }
  } catch (e) {
    console.log('Desktop UFI failed:', e.response?.status);
  }

  // 🔥 METHOD 2: Mobile fallback
  try {
    await axios.get(`https://m.facebook.com/story.php?story_fbid=${storyFbid}`, {
      headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15' }
    });

    const mobileRes = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?story_id=${storyFbid}`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid,
        'feedback_reaction': reactionIds[reaction] || 0
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://m.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    const success = mobileRes.status === 200;
    res.json({ 
      success, 
      method: 'mobile_ufi',
      status: mobileRes.status,
      preview: mobileRes.data.slice(0, 300)
    });
  } catch (error) {
    res.json({ 
      error: error.response?.status,
      preview: error.response?.data?.slice(0, 300),
      cookieInfo: {
        c_user: cUser,
        has_xs: cookie.includes('xs='),
        has_fr: cookie.includes('fr='),
        width: cookie.match(/wd=([^;]+)/)?.[1]
      }
    });
  }
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>Facebook Bot v2</title>
<style>body{font-family:Arial;max-width:600px;margin:50px auto;padding:20px;background:#1a1a2e;color:white;}
input,button{width:100%;padding:15px;margin:10px 0;border-radius:8px;border:none;font-size:16px;}
button{background:#00d4aa;color:white;cursor:pointer;font-weight:bold;}
#result{background:#2d2d44;padding:20px;border-radius:8px;max-height:400px;overflow:auto;white-space:pre-wrap;}
.green {color:#00d4aa;}
</style></head>
<body>
<h1>🔥 Facebook Bot v2 (Desktop + Mobile)</h1>
<input id="cookie" placeholder="Paste FULL cookie" style="height:80px">
<input id="url" placeholder="Any Facebook post URL" style="height:50px">
<button onclick="test()">🚀 LIKE POST</button>
<div id="result">Ready to test...</div>
<script>
async function test() {
  const result = document.getElementById('result');
  result.innerHTML = 'Testing...';
  try {
    const res = await fetch('/react', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        cookie: document.getElementById('cookie').value,
        url: document.getElementById('url').value
      })
    });
    const data = await res.json();
    result.innerHTML = JSON.stringify(data, null, 2);
    if (data.success) result.className = 'green';
  } catch(e) {
    result.textContent = 'Network error';
  }
}
</script>
</body>
</html>
`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🔥 Bot v2:', PORT));
