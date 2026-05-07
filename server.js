const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const reactionIds = {
  like: 0,
  love: 1,
  haha: 4,
  wow: 3,
  sad: 2,
  angry: 7
};

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1] || 
                   url.match(/story_id=([^&]+)/)?.[1] ||
                   url.match(/permalink\/(\d+)/)?.[1];

  if (!cUser || !storyFbid) {
    return res.json({ error: 'Missing c_user or story_fbid/story_id' });
  }

  console.log(`🚀 Reacting ${reaction} | Post: ${storyFbid} | User: ${cUser}`);

  // 🔥 METHOD 1: Desktop UFI (most reliable)
  try {
    const desktopRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/like.php?__a=1&story_id=${storyFbid}`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid,
        'reaction_type': reactionIds[reaction] || 0
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-FB-Friendly-Name': 'LikeButtonController',
          'Origin': 'https://www.facebook.com'
        },
        timeout: 10000
      }
    );

    if (desktopRes.status === 200) {
      const success = desktopRes.data.includes('Unlike') || 
                     desktopRes.data.includes('removePreview') ||
                     desktopRes.data.includes('"client_mutation_id"') ||
                     desktopRes.data.includes('reaction');
      
      return res.json({ 
        success, 
        method: 'desktop_ufi ✅',
        status: desktopRes.status,
        preview: desktopRes.data.slice(0, 500),
        cookieInfo: {
          c_user: cUser,
          has_xs: cookie.includes('xs='),
          has_fr: cookie.includes('fr='),
          width: cookie.match(/wd=([^;]+)/)?.[1]
        }
      });
    }
  } catch (e) {
    console.log('Desktop UFI failed:', e.response?.status, e.message);
  }

  // 🔥 METHOD 2: Mobile UFI (fallback)
  try {
    // Preload mobile page first
    await axios.get(`https://m.facebook.com/story.php?story_fbid=${storyFbid}`, {
      headers: { 
        'Cookie': cookie, 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      timeout: 5000
    });

    const mobileRes = await axios.post(
      `https://m.facebook.com/ajax/ufi/like.php?__a=1&story_id=${storyFbid}`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid,
        'ft_id': storyFbid,
        'source': '60',
        'feedback_reaction': reactionIds[reaction] || 0
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Referer': `https://m.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-FB-Friendly-Name': 'LikeButtonController',
          'Origin': 'https://m.facebook.com'
        },
        timeout: 10000
      }
    );

    const success = mobileRes.status === 200 && (
      mobileRes.data.includes('Unlike') || 
      mobileRes.data.includes('reaction') ||
      !mobileRes.data.includes('error')
    );

    return res.json({ 
      success, 
      method: 'mobile_ufi ✅',
      status: mobileRes.status,
      preview: mobileRes.data.slice(0, 500),
      cookieInfo: {
        c_user: cUser,
        has_xs: cookie.includes('xs='),
        has_fr: cookie.includes('fr='),
        width: cookie.match(/wd=([^;]+)/)?.[1]
      }
    });
  } catch (error) {
    console.error('Mobile failed:', error.response?.status);
    
    return res.json({ 
      error: error.response?.status || error.message,
      preview: error.response?.data ? String(error.response.data).slice(0, 500) : 'No response data',
      cookieInfo: {
        c_user: cUser,
        has_xs: cookie.includes('xs='),
        has_fr: cookie.includes('fr='),
        width: cookie.match(/wd=([^;]+)/)?.[1]
      },
      debug: {
        story_id: storyFbid,
        reaction: reaction,
        reaction_id: reactionIds[reaction]
      }
    });
  }
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>🚀 Facebook Bot v3 (Fixed)</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial;max-width:700px;margin:50px auto;padding:20px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:white;}
input,textarea,button{width:100%;padding:15px;margin:10px 0;border-radius:12px;border:none;font-size:16px;box-shadow:0 4px 14px rgba(0,0,0,0.3);}
textarea{height:100px;resize:vertical;}
button{background:linear-gradient(135deg,#00d4aa,#00b894);color:white;cursor:pointer;font-weight:700;font-size:18px;transition:all 0.3s;}
button:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,212,170,0.4);}
#result{background:rgba(45,45,68,0.8);backdrop-filter:blur(10px);padding:25px;border-radius:12px;max-height:500px;overflow:auto;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.1);}
.green {border-left:4px solid #00d4aa;}
.red {border-left:4px solid #ff6b6b;}
h1{font-size:28px;text-align:center;margin-bottom:30px;background:linear-gradient(135deg,#00d4aa,#00b894);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
</style></head>
<body>
<h1>🚀 Facebook Bot v3 (Desktop + Mobile FIXED)</h1>
<textarea id="cookie" placeholder="Paste your FULL Facebook cookies here... (mobile cookies work great!)"></textarea>
<input id="url" placeholder="https://www.facebook.com/story.php?story_fbid=XXXXX&id=XXXXX" style="height:50px;">
<select id="reaction" style="padding:15px;font-size:16px;">
  <option value="like">👍 Like</option>
  <option value="love">❤️ Love</option>
  <option value="haha">😂 Haha</option>
  <option value="wow">😮 Wow</option>
  <option value="sad">😢 Sad</option>
  <option value="angry">😠 Angry</option>
</select>
<button onclick="test()">🚀 REACT TO POST</button>
<div id="result">Ready to test... 📱 Works with mobile cookies!</div>

<script>
async function test() {
  const result = document.getElementById('result');
  const btn = event.target;
  btn.textContent = 'Testing... ⏳';
  btn.disabled = true;
  result.innerHTML = '🔄 Testing reaction...';
  
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
    result.innerHTML = JSON.stringify(data, null, 2);
    
    if (data.success) {
      result.className = 'green';
      result.innerHTML += '\n\n✅ SUCCESS! Reaction applied!';
    } else if (data.error) {
      result.className = 'red';
    }
  } catch(e) {
    result.innerHTML = '❌ Network error: ' + e.message;
    result.className = 'red';
  }
  
  btn.textContent = '🚀 REACT TO POST';
  btn.disabled = false;
}
</script>
</body>
</html>
`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Facebook Bot v3 FIXED running on port ${PORT}`);
  console.log('✅ Supports: Desktop + Mobile cookies');
  console.log('✅ Reactions: like, love, haha, wow, sad, angry');
});
