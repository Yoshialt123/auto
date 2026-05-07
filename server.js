const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/test', async (req, res) => {
  const { cookie, url } = req.body;
  console.log('TEST:', url.slice(0, 50));
  
  const postId = url.match(/story_fbid=([^&]+)/)?.[1];
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  
  if (!postId || !cUser) {
    return res.json({ error: 'Invalid cookie/URL' });
  }

  try {
    const likeRes = await axios.post(
      `https://www.facebook.com/ajax/ufi/like.php?story_id=${postId}`,
      new URLSearchParams({ '__user': cUser, '__a': '1', 'story_id': postId }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `https://www.facebook.com/${postId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    const success = likeRes.status === 200 && likeRes.data.includes('Unlike');
    res.json({ success, status: likeRes.status, preview: likeRes.data.slice(0, 200) });
  } catch (e) {
    res.json({ error: e.response?.status || e.message });
  }
});

app.get('/', (req, res) => res.send(`
  <h1>🧪 Facebook Test</h1>
  <input id="cookie" placeholder="Cookie" style="width:100%;height:50px"><br><br>
  <input id="url" placeholder="Post URL" style="width:100%"><br><br>
  <button onclick="test()">TEST LIKE</button>
  <pre id="result"></pre>
  <script>
    async function test() {
      const res = await fetch('/test', {
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
`));

app.listen(process.env.PORT || 3000);
