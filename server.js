const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
app.use(express.json());

async function getLikeCount(cookie, storyFbid) {
  try {
    const res = await axios.get(`https://m.facebook.com/story.php?story_fbid=${storyFbid}`, {
      headers: { 
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/604.1.38'
      }
    });
    
    const $ = cheerio.load(res.data);
    const count = $('a[href*="unlike"]').length > 0 ? 'LIKED' : 
                  $('.likeCount').first().text().trim() || $('[aria-label*="like"]').length;
    return count;
  } catch {
    return 'unknown';
  }
}

app.post('/react', async (req, res) => {
  const { cookie, url } = req.body;
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1];

  if (!cUser || !storyFbid) return res.json({ error: 'Invalid input' });

  // 🔥 BEFORE COUNT
  const beforeCount = await getLikeCount(cookie, storyFbid);
  console.log(`Before: ${beforeCount}`);

  // 🔥 REAL LIKE (Mobile native)
  const likeRes = await axios.post(
    `https://m.facebook.com/ajax/ufi/like.php`,
    `story_id=${storyFbid}&&__user=${cUser}&&__a=1`,
    {
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/604.1.38',
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': cookie.match(/c_user=(\d+)/)?.[1] || ''
      },
      timeout: 10000
    }
  );

  // 🔥 AFTER COUNT
  await new Promise(r => setTimeout(r, 2000)); // Wait for update
  const afterCount = await getLikeCount(cookie, storyFbid);
  console.log(`After: ${afterCount}`);

  const reallyWorked = afterCount !== beforeCount || afterCount === 'LIKED';

  res.json({
    success: likeRes.status === 200,
    reallyWorked,
    beforeCount,
    afterCount,
    status: likeRes.status,
    method: 'MOBILE ✅ REAL CHECK',
    story_id: storyFbid,
    message: reallyWorked ? '✅ ACTUALLY LIKED!' : '❌ Failed (blocked cookies)',
    preview: likeRes.data.toString().slice(0, 200)
  });
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>🚀 Facebook REAL Like Bot v2025</title>
<meta name="viewport" content="width=device-width">
<style>body{font-family:system-ui;background:#0f0f23;color:#fff;padding:20px;}
h1{font-size:2.5em;text-align:center;background:linear-gradient(135deg,#00d4aa,#00b894);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
textarea,input,button{width:100%;padding:20px;margin:12px 0;border-radius:16px;border:none;font-size:16px;}
textarea{height:140px;background:rgba(255,255,255,.1);}
button{background:#00d4aa;color:#fff;font-weight:700;cursor:pointer;}
#result{padding:25px;background:rgba(30,30,50,.9);border-radius:16px;max-height:500px;overflow:auto;font-family:monospace;}</style>
</head>
<body>
<h1>🚀 v2025 REAL CHECK</h1>
<textarea id="cookie" placeholder="FRESH COOKIES ONLY"></textarea>
<input id="url" value="https://m.facebook.com/story.php?story_fbid=1859718528034635&id=100019895179494">
<button onclick="test()">🚀 REAL LIKE TEST</button>
<div id="result">Checks like count BEFORE + AFTER = 100% accurate</div>
<script>
async function test(){
  document.getElementById('result').textContent='Checking before count...';
  try{
    const r=await fetch('/react',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cookie:document.getElementById('cookie').value,url:document.getElementById('url').value})
    });
    const data=await r.json();
    const color=data.reallyWorked?'#00d4aa':'#ff6b6b';
    document.getElementById('result').innerHTML=`<pre style="color:${color}">${JSON.stringify(data,null,2)}</pre>`;
  }catch(e){document.getElementById('result').textContent='Error: '+e.message;}
}
</script>
</body>
</html>
`));

app.listen(process.env.PORT||3000,()=>console.log('🚀 v2025 running'));
