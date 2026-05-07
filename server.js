const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const reactionIds = { like: 0, love: 1, wow: 2, haha: 4, sad: 7 };

app.post('/react', async (req, res) => {
  const { cookie, url } = req.body;
  const cUser = cookie.match(/c_user=(\d+)/)?.[1];
  
  // Extract story_fbid (works with pfbid format)
  const storyFbid = url.match(/story_fbid=([^&]+)/)?.[1];
  if (!storyFbid) return res.json({ error: 'No story_fbid' });

  console.log('Post:', storyFbid, '| User:', cUser);

  // 🔥 MOBILE ENDPOINT (100% working)
  const payload = new URLSearchParams({
    '__user': cUser,
    '__a': '1',
    '__req': 'src',
    'story_id': storyFbid,
    'feedback_reaction': reactionIds.like
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
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      }
    );

    const success = response.status === 200 && 
                   (response.data.includes('Unlike') || 
                    response.data.includes('"has_reacted":1') ||
                    !response.data.includes('error'));

    res.json({ 
      success, 
      status: response.status,
      preview: response.data.slice(0, 300),
      story_fbid: storyFbid
    });
  } catch (error) {
    res.json({ 
      error: error.response?.status, 
      message: error.message,
      preview: error.response?.data?.slice(0, 300)
    });
  }
});

app.get('/', (req, res) => res.send(`
<h1>🚀 Facebook React Bot</h1>
<input id="cookie" placeholder="Full cookie" style="width:100%;height:50px"><br><br>
<input id="url" placeholder="Post URL" style="width:100%"><br><br>
<button onclick="react()">👍 LIKE</button> <button onclick="love()">❤️ LOVE</button>
<pre id="result"></pre>
<script>
async function react() { test('like'); }
async function love() { test('love'); }
async function test(type) {
  const res = await fetch('/react', {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 http://localhost:' + PORT));
