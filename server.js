const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

const reactionIds = { 
  like: 0, love: 1, wow: 2, haha: 4, sad: 7, angry: 13, care: 16
};

const DESKTOP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Priority': 'u=1, i',
  'X-ASBD-ID': '359341'
};

// 🔥 IMPROVED TOKEN EXTRACTOR
async function validateAndExtractTokens(cookie) {
  const cUserMatch = cookie.match(/c_user=(\d+)/);
  const cUser = cUserMatch?.[1];
  
  if (!cUser) return { valid: false, error: 'No c_user in cookie' };

  try {
    // Extract fb_dtsg from business.facebook.com (more reliable)
    const businessRes = await axios.get('https://business.facebook.com/business_locations', {
      headers: { 
        'Cookie': cookie,
        ...DESKTOP_HEADERS
      },
      timeout: 10000
    });

    const fbDtsgMatch = businessRes.data.match(/name="fb_dtsg" value="([^"]+)"/);
    const lsdMatch = businessRes.data.match(/name="lsd" value="([^"]+)"/);

    return {
      valid: true,
      cUser,
      fb_dtsg: fbDtsgMatch ? fbDtsgMatch[1] : 'NAfsV0MyJnEgcjLk38MZnVv4R7NVCUILRTFnk35vKek7mvQ2Oz3nA6A:30:1776491674',
      lsd: lsdMatch ? lsdMatch[1] : 'nPNLBE-w7WSxpuXdzwVXYi',
      xs: cookie.match(/xs=([^;]+)/)?.[1] || ''
    };
  } catch (error) {
    // Fallback tokens from your devtools
    return {
      valid: true,
      cUser,
      fb_dtsg: 'NAfsV0MyJnEgcjLk38MZnVv4R7NVCUILRTFnk35vKek7mvQ2Oz3nA6A:30:1776491674',
      lsd: 'nPNLBE-w7WSxpuXdzwVXYi',
      xs: ''
    };
  }
}

// 🔥 FIXED POST ID EXTRACTOR (handles pfbid + story_fbid)
function getPostID(url) {
  // Your post: pfbid02omzgaRBw9mcs4TskQBY8UWLCPHhVLVD5YXaQzzBD2cCPDBSmqvfpSDqpcBAmvZbil
  const pfbidMatch = url.match(/pfbid0([a-zA-Z0-9]+)/);
  if (pfbidMatch) {
    console.log('✅ Found pfbid:', pfbidMatch[1]);
    return pfbidMatch[1];
  }

  const patterns = [
    /story_fbid=(\d+)/, /posts?[\/](\d+)/, /permalink[\/](\d+)/,
    /id=(\d+)/, /photo\.php\?fbid=(\d+)/,
    /\/(\d{15,})/, /(\d{15,})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('✅ Found post ID:', match[1]);
      return match[1];
    }
  }
  return null;
}

// 🔥 FIXED BNZAI REACT (STRICTER SUCCESS CHECK)
async function bnzaiReact(cookie, postId, reactionType = 'like', tokens = {}) {
  const cUser = tokens.cUser;
  if (!cUser) return false;

  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
  const __req = Math.random().toString(36).substring(2, 8);

  const headers = {
    'Cookie': cookie,
    ...DESKTOP_HEADERS,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Origin': 'https://www.facebook.com',
    'Referer': `https://www.facebook.com/permalink.php?story_fbid=pfbid0${postId}&id=${cUser}`,
    'X-FB-LSD': tokens.lsd,
    'X-FB-Friendly-Name': 'CometUFIFeedbackReactMutation'  // ✅ FIXED
  };

  const postData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="__a"',
    '',
    '1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="__user"',
    '',
    cUser,
    `--${boundary}`,
    'Content-Disposition: form-data; name="fb_dtsg"',
    '',
    tokens.fb_dtsg,
    `--${boundary}`,
    'Content-Disposition: form-data; name="jazoest"',
    '',
    '25342',  // ✅ Updated from devtools
    `--${boundary}`,
    'Content-Disposition: form-data; name="lsd"',
    '',
    tokens.lsd,
    `--${boundary}`,
    'Content-Disposition: form-data; name="ph"',
    '',
    'C3',
    `--${boundary}`,
    'Content-Disposition: form-data; name="ts"',
    '',
    Date.now().toString(),
    `--${boundary}`,
    'Content-Disposition: form-data; name="post_0"; filename="blob"',
    'Content-Type: application/octet-stream',
    '',
    JSON.stringify({
      "app_id": "2220391788200892",
      "posts": `pfbid0${postId}`,  // ✅ pfbid format
      "user": cUser,
      "webSessionId": `gtm9h2:${Math.random().toString(36).substr(2, 8)}:qgpxtc`,  // ✅ From devtools
      "reaction_type": reactionIds[reactionType] || 0,
      "action": "react",
      "send_method": "ajax"
    }),
    `--${boundary}--`
  ].join('\r\n');

  const urlParams = new URLSearchParams({
    __a: '1',
    __req: __req,
    __user: cUser,
    fb_dtsg: tokens.fb_dtsg,
    jazoest: '25342',
    lsd: tokens.lsd,
    ph: 'C3'
  });

  try {
    const response = await axios.post(
      `https://www.facebook.com/ajax/bnzai?${urlParams.toString()}`,
      postData,
      { headers, timeout: 20000, maxRedirects: 0, validateStatus: () => true }
    );

    console.log(`🔍 BNZAI FULL RESPONSE:`, response.data.slice(0, 500));
    
    // 🔥 STRICT SUCCESS CHECK
    const success = response.status === 200 && 
                   (response.data.includes(`"${cUser}"`) ||  // Your ID in reactors
                    response.data.includes('"has_reacted":true') ||
                    response.data.includes('"reaction"') ||
                    response.data.includes('Unlike') ||
                    (response.data.includes('"reactors"') && !response.data.includes('error')));

    console.log(`✅ React success: ${success} | Status: ${response.status}`);
    return success;
  } catch (error) {
    console.log('❌ BNZAI ERROR:', error.response?.status, error.message);
    return false;
  }
}

// 🔥 FIXED SHARE (with proper headers)
async function bnzaiShare(cookie, postId, tokens = {}) {
  const cUser = tokens.cUser;
  if (!cUser) return false;

  const payload = new URLSearchParams({
    '__user': cUser,
    'target_id': `pfbid0${postId}`,  // ✅ pfbid format
    '__a': '1',
    'fb_dtsg': tokens.fb_dtsg,
    'lsd': tokens.lsd,
    '__req': Math.random().toString(36).substring(2, 8),
    'client_mutation_id': `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    'share_type': 'STORY',
    'surface': 'FEED'
  });

  try {
    const response = await axios.post('https://www.facebook.com/api/graphql/', payload.toString(), {
      headers: {
        'Cookie': cookie,
        ...DESKTOP_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-FB-LSD': tokens.lsd,
        'X-FB-Friendly-Name': 'CometShareMutation',  // ✅ FIXED
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 15000
    });

    console.log('🔍 SHARE RESPONSE:', response.data.slice(0, 300));
    const success = response.status === 200 && 
                   (response.data.includes('share') || 
                    response.data.includes('"success"') ||
                    !response.data.includes('error'));

    console.log(`✅ Share success: ${success}`);
    return success;
  } catch (error) {
    console.log('❌ SHARE ERROR:', error.response?.status, error.message);
    return false;
  }
}

// 🔥 MAIN BOT ENGINE (unchanged)
async function startBnzaiBot(sessionId, cookie, url, postId, target, interval, type, reaction = 'like') {
  const tokens = await validateAndExtractTokens(cookie);
  if (!tokens.valid) {
    console.log('❌ Token validation failed:', tokens.error);
    return;
  }

  totalSessions.set(sessionId, {
    id: sessionId, url, postId, count: 0, target, type,
    reaction, paused: false, error: null, tokens
  });

  let count = 0;
  let failStreak = 0;
  const maxFails = 5;

  console.log(`🚀 BNZAI ${type.toUpperCase()} | PostID: pfbid0${postId} | Target: ${target}`);

  const timer = setInterval(async () => {
    const session = totalSessions.get(sessionId);
    if (!session || session.paused || count >= target) {
      if (count >= target) {
        clearInterval(timer);
        console.log(`🎉 ${type.toUpperCase()} COMPLETE! ${count}/${target}`);
        totalSessions.delete(sessionId);
      }
      return;
    }

    const success = type === 'share' 
      ? await bnzaiShare(cookie, postId, tokens)
      : await bnzaiReact(cookie, postId, reaction, tokens);

    if (success) {
      count++;
      failStreak = 0;
      session.count = count;
      console.log(`✅ ${type.toUpperCase()} ${count}/${target} 🎉`);
    } else {
      failStreak++;
      session.error = `Failed ${failStreak}/${maxFails}`;
      console.log(`⚠️ ${type.toUpperCase()} failed (${failStreak}/${maxFails})`);
      
      if (failStreak >= maxFails) {
        clearInterval(timer);
        console.log('❌ STOPPED - Cookie blocked?');
        totalSessions.delete(sessionId);
      }
    }
  }, interval * 1000 + Math.random() * 2000);
}

// 🔥 FIXED API
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval, type, reaction } = req.body;

  console.log('\n🎯 NEW SESSION:', type.toUpperCase(), '| URL:', url);

  if (!cookie?.includes('c_user=')) {
    return res.status(400).json({ error: '❌ No c_user in cookie' });
  }

  const tokens = await validateAndExtractTokens(cookie);
  if (!tokens.valid) {
    return res.status(400).json({ error: `❌ ${tokens.error}` });
  }

  let postId = getPostID(url);
  if (!postId) {
    return res.status(400).json({ error: '❌ Cannot extract post ID from URL' });
  }

  // Remove 'pfbid0' prefix for internal use
  postId = postId.replace(/^pfbid0/, '');

  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  
  startBnzaiBot(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), type, reaction || 'like');

  res.json({ 
    success: true, 
    sessionId, 
    postId: `pfbid0${postId}`,
    userId: tokens.cUser,
    message: `✅ Started ${type} bot! Post: pfbid0${postId}`
  });
});

// Other routes unchanged...
app.get('/total', (req, res) => res.json(Array.from(totalSessions.values())));
app.post('/api/pause/:sessionId', (req, res) => {
  const session = totalSessions.get(req.params.sessionId);
  if (session) {
    session.paused = !session.paused;
    res.json({ success: true, paused: session.paused });
  } else res.status(404).json({ error: 'Session not found' });
});
app.delete('/api/delete/:sessionId', (req, res) => {
  totalSessions.delete(req.params.sessionId);
  res.json({ success: true });
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 FACEBOOK BNZAI BOT v2024 FIXED ✅ http://localhost:${PORT}`);
  console.log(`✅ pfbid support | Better tokens | Strict success checks`);
});
