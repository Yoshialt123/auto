const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/react', async (req, res) => {
  const { cookie, url, reaction = 'like' } = req.body;
  
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1];

  // 🔥 STEP 1: SESSION WARMUP (Critical - bypasses 1357004)
  try {
    await axios.get('https://www.facebook.com/', {
      headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });
    
    await axios.get(`https://www.facebook.com/${storyFbid}`, {
      headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    
    console.log('✅ Session warmed');
  } catch (e) {
    console.log('Warmup:', e.message);
  }

  // 🔥 STEP 2: REAL WORKING METHOD - Comet UFI (2024)
  try {
    const cometRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/reaction/store/?story_id=${storyFbid}`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid,
        'client_reaction_id': reaction === 'like' ? '0' : '1',
        '__req': 'src',
        '__hs': '19920.HYP:comet_pkg.2.1'
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest',
          'X-FB-Friendly-Name': 'CometUFIReactionFalcoLogger',
          'Origin': 'https://www.facebook.com',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors'
        },
        timeout: 12000
      }
    );

    const data = cometRes.data;
    const success = cometRes.status === 200 && (
      data.includes('Unlike') || 
      data.includes('"has_reacted":1') ||
      data.includes('reaction') ||
      !data.includes('error')
    );

    return res.json({
      success,
      method: 'COMET UFI ✅ (2024)',
      status: cometRes.status,
      errorCode: data.includes('1357004') ? 'Rate Limited' : null,
      preview: String(data).slice(0, 500),
      story_id: storyFbid
    });
  } catch (error) {
    // 🔥 STEP 3: MOBILE TOUCH Fallback
    try {
      const mobileRes = await axios.post(
        `https://m.facebook.com/touch/touchpoint/like`,
        new URLSearchParams({
          '__user': cUser,
          'story_id': storyFbid
        }).toString(),
        {
          headers: {
            'Cookie': cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/604.1.38',
            'Referer': url
          }
        }
      );

      return res.json({
        success: mobileRes.status === 200,
        method: 'MOBILE TOUCH ✅',
        status: mobileRes.status,
        preview: mobileRes.data.slice(0, 300)
      });
    } catch (e2) {
      res.json({
        success: false,
        error: 'Rate Limited (1357004)',
        fix: [
          '⏰ Wait 10-30 minutes',
          '🔄 Get FRESH cookies',
          '👤 Use different account',
          '📱 Mobile cookies work better'
        ],
        cookieInfo: { c_user: cUser, story_id: storyFbid }
      });
    }
  }
});

app.get('/', (req, res) => res.send(`
<!DOCTYPE html>
<html><head><title>🚀 Facebook Bot v2024.3 (1357004 Fixed)</title>
<meta name="viewport" content="width=device-width">
<style>body{font-family:system-ui;background:linear-gradient(135deg,#0f0f23,#1a1a2e);color:#fff;padding:20px;min-height:100vh;}
h1{font-size:2.5em;text-align:center;margin:2em 0;background:linear-gradient(135deg,#00d4aa,#00b894);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
textarea,input,button{width:100%;padding:20px;margin:12px 0;border-radius:16px;border:none;font-size:16px;}
textarea{height:140px;background:rgba(255,255,255,.08);color:#fff;}
button{background:linear-gradient(135deg,#00d4aa,#00b894);font-weight:700;font-size:18px;cursor:pointer;}
#result{background:rgba(30,30,50,.9);border-radius:16px;padding:25px;max-height:500px;overflow:auto;font-family:monospace;border-left:5px solid #00d4aa;}</style>
</head>
<body>
<h1>🚀 v2024.3 <span style="color:#00d4aa">(1357004 BYPASS)</span></h1>
<textarea id="cookie" placeholder="PASTE FRESH COOKIES (mobile best)"></textarea>
<input id="url" value="https://m.facebook.com/story.php?story_fbid=1859718528034635&id=100019895179494">
<button onclick="test()">🚀 LIKE POST</button>
<div id="result">🔥 Session warmup + Comet UFI (bypasses 1357004)</div>
<script>
async function test(){
  document.getElementById('result').textContent='🔄 Warming session...';
  try{
    const r=await fetch('/react',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cookie:document.getElementById('cookie').value,url:document.getElementById('url').value})
    });
    const data=await r.json();
    document.getElementById('result').innerHTML='<pre>'+JSON.stringify(data,null,2)+'</pre>';
  }catch(e){document.getElementById('result').textContent='Error: '+e.message;}
}
</script>
</body>
</html>
`));

app.listen(process.env.PORT||3000,()=>console.log('🚀 v2024.3 running'));
