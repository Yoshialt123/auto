const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // npm install cheerio
const app = express();
app.use(express.json());

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

  console.log(`🚀 Reacting ${reaction} | Post: ${storyFbid} | User: ${cUser}`);

  // 🔥 METHOD 1: NEW GRAPHQL ENDPOINT (2024 working)
  try {
    const graphqlRes = await axios.post(
      'https://www.facebook.com/api/graphql/',
      `variables={"input":{"feedback_id":"${storyFbid}_0","client_mutation_id":"1","actor_id":"${cUser}","feedback_reaction_info":{"client_mutation_id":"2","reaction":{"reaction_id":${reactionIds[reaction] || 0},"surface":"WWW_FEED_STORY"},"source":"FEED"}}&doc_id=1477040885842969`,
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `https://www.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-FB-Friendly-Name': 'PolarisFeedStoryViewer.react',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.facebook.com'
        }
      }
    );

    if (graphqlRes.status === 200) {
      const data = graphqlRes.data;
      const success = data.includes('client_mutation_id') || 
                     data.includes('"reaction"') ||
                     !data.includes('error');
      
      return res.json({ 
        success, 
        method: 'GraphQL ✅ (NEW 2024)',
        status: graphqlRes.status,
        preview: data.slice(0, 500),
        cookieInfo: { c_user: cUser, has_xs: cookie.includes('xs='), has_fr: cookie.includes('fr=') }
      });
    }
  } catch (e) {
    console.log('GraphQL failed:', e.response?.status);
  }

  // 🔥 METHOD 2: Touch endpoint (bypass UFI)
  try {
    const touchRes = await axios.post(
      `https://www.facebook.com/ajax/touch/touchpoint/www_composer`,
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `https://www.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    const success = touchRes.status === 200;
    return res.json({ 
      success, 
      method: 'Touch Endpoint ✅',
      status: touchRes.status,
      preview: touchRes.data.slice(0, 300)
    });
  } catch (e) {
    console.log('Touch failed:', e.response?.status);
  }

  // 🔥 METHOD 3: MBASIC (works with mobile cookies)
  try {
    const mbasicRes = await axios.post(
      `https://mbasic.facebook.com/ajax/ufi/like.php`,
      new URLSearchParams({
        '__user': cUser,
        '__a': '1',
        'story_id': storyFbid,
        'profile_id': storyFbid.split('_')[0]
      }).toString(),
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': `https://mbasic.facebook.com/story.php?story_fbid=${storyFbid}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    const success = mbasicRes.status === 200;
    return res.json({ 
      success, 
      method: 'MBASIC ✅ (Mobile)',
      status: mbasicRes.status,
      preview: mbasicRes.data.slice(0, 300),
      cookieInfo: { c_user: cUser, has_xs: cookie.includes('xs='), has_fr: cookie.includes('fr=') }
    });
  } catch (error) {
    res.json({ 
      error: error.response?.status,
      preview: String(error.response?.data || '').slice(0, 500),
      cookieInfo: { c_user: cUser, has_xs: cookie.includes('xs='), has_fr: cookie.includes('fr=') },
      debug: { story_id: storyFbid, reaction: reaction }
    });
  }
});
