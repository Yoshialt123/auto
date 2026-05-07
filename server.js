const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());
app.use(express.static('public'));

const reactionIds = { like: 0, love: 1, haha: 4, wow: 3, sad: 2, angry: 7 };

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1] || 
                   url.match(/story_id=([^&]+)/)?.[1] ||
                   url.match(/permalink\/(\d+)/)?.[1];

  if (!cUser || !storyFbid) {
    return res.json({ error: 'Missing c_user or story_fbid/story_id' });
  }

  console.log(`🚀 ${reaction.toUpperCase()} | Post: ${storyFbid} | User: ${cUser}`);

  // 🔥 METHOD 1: MBASIC (WORKS BEST with mobile cookies)
  try {
    const mbasicRes = await axios.post(
      `https://mbasic.facebook.com/ajax/ufi/like.php`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://mbasic.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      }
    );

    const success = mbasicRes.status === 200 && (
      mbasicRes.data.includes('Unlike') || 
      mbasicRes.data.includes('removePreview') ||
      mbasicRes.data.includes('reaction')
    );

    if (success) {
      return res.json({ 
        success: true, 
        method: 'MBASIC ✅ (Mobile)',
        status: mbasicRes.status,
        preview: mbasicRes.data.slice(0, 300),
        cookieInfo: { c_user: cUser, has_xs: cookie.includes('xs='), has_fr: cookie.includes('fr=') }
      });
    }
  } catch (e) {
    console.log('MBASIC failed:', e.response?.status);
  }

  // 🔥 METHOD 2: Desktop UFI (updated)
  try {
    const desktopRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/like.php?__a=1`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.facebook.com'
        },
        timeout: 10000
      }
    );

    const success = desktopRes.status === 200;
    return res.json({ 
      success, 
      method: 'Desktop UFI ✅',
      status: desktopRes.status,
      preview: desktopRes.data.slice(0, 300),
      cookieInfo: { c_user: cUser, has_xs: cookie.includes('xs='), has_fr: cookie.includes('fr=') }
    });
  } catch (error) {
    res.json({ 
      error: error.response?.status || error.message,
      preview: String(error.response?.data || '').slice(0, 500),
      cookieInfo: { 
        c_user: cUser, 
        has_xs: cookie.includes('xs='), 
        has_fr: cookie.includes('fr='),
        width: cookie.match(/wd=([^;]+)/)?.[1]
      },
      debug: { story_id: storyFbid, reaction }
    });
  }
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>🚀 Facebook Bot v4 (Render Ready)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* {margin:0;padding:0;box-sizing:border-box;}
body {font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
      color: white; min-height: 100vh; padding: 20px;}
.container {max-width: 600px; margin: 0 auto;}
h1 {text-align: center; font-size: 28px; margin: 30px 0; 
    background: linear-gradient(135deg, #00d4aa, #00b894); 
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;}
textarea, input, select {width: 100%; padding: 18px; margin: 12px 0; 
                        border-radius: 12px; border: none; font-size: 16px; 
                        background: rgba(255,255,255,0.1); color: white;
                        backdrop-filter: blur(10px);}
textarea {height: 120px; resize: vertical;}
button {width: 100%; padding: 20px; background: linear-gradient(135deg, #00d4aa, #00b894); 
        color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: 700;
        cursor: pointer; transition: all 0.3s;}
button:hover {transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,212,170,0.4);}
#result {background: rgba(45,45,68,0.8); border-radius: 12px; padding: 25px; 
         max-height: 400px; overflow: auto; white-space: pre-wrap; margin-top: 20px;
         border-left: 4px solid #00d4aa; backdrop-filter: blur(10px);}
.red {border-left-color: #ff6b6b !important;}
.success {border-left-color: #00d4aa !important;}
.loading {background: rgba(0,212,170,0.2); animation: pulse 1.5s infinite;}
@keyframes pulse {0%,100%{opacity:1} 50%{opacity:0.5}}
@media (max-width: 600px) {body {padding: 10px;} h1 {font-size: 24px;}}
</style></head>
<body>
<div class="container">
<h1>🚀 Facebook Bot v4 (Render)</h1>
<textarea id="cookie" placeholder="Paste FULL Facebook cookies (mobile works best!)"></textarea>
<input id="url" placeholder="https://facebook.com/story.php?story_fbid=XXXXX..." value="https://www.facebook.com/story.php?story_fbid=1859718528034635&id=100019895179494">
<select id="reaction">
  <option value="like">👍 Like</option>
  <option value="love">❤️ Love</option>
  <option value="haha">😂 Haha</option>
</select>
<button onclick="test()">🚀 REACT NOW</button>
<div id="result">Ready! 📱 Your mobile cookies will work perfectly...</div>
</div>
<script>
async function test() {
  const result = document.getElementById('result');
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Testing...';
  result.textContent = '🔄 Sending reaction...';
  result.className = 'loading';
  
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
    result.textContent = JSON.stringify(data, null, 2);
    result.className = data.success ? 'success' : 'red';
  } catch(e) {
    result.textContent = '❌ Error: ' + e.message;
    result.className = 'red';
  }
  
  btn.disabled = false;
  btn.textContent = '🚀 REACT NOW';
}
</script>
</body>
</html>
`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Facebook Bot v4 running on port ${PORT}`);
});
