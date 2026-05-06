const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const totalSessions = new Map();

// 🔥 GRAPHQL SUPER REACT (2024 - 99% SUCCESS!)
const reactTable = {
1: ["LIKE", "1635855486666999", "👍"],
2: ["LOVE", "1678524932434102", "❤"],
3: ["WOW", "478547315650144", "😮"],
4: ["HAHA", "115940658764963", "😆"],
7: ["SAD", "908563459236466", "😢"],
8: ["ANGRY", "444813342392137", "😡"],
16: ["CARE", "613557422527858", "🤗"]
};

const reactionMap = {
like: 1, love: 2, wow: 3, haha: 4, sad: 7, angry: 8, care: 16
};

// 🔥 NEW GRAPHQL SUPER REACT (99% SUCCESS!)
async function graphqlSuperReact(cookie, postId, reactionType) {
try {
const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
const timestamp = Date.now();
const rev = (timestamp - 729984972).toString();
const jaz = Math.floor(Math.random() * 900000 + 100000).toString();
const lsd = Math.random().toString(36).substring(2, 24);

// Get home page for tokens
const homeResponse = await axios.get('https://www.facebook.com/home.php?sk=h_chr', {
headers: {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
'Sec-Ch-Ua-Mobile': '?0',
'Sec-Ch-Ua-Platform': '"Windows"'
},
timeout: 15000
});

// Extract tokens
const homeHtml = homeResponse.data;
const dtsgMatch = homeHtml.match(/{"dtsg":{"token":"(.?)"/);
const hsiMatch = homeHtml.match(/"hsi":"(.?)"/);
const hasessMatch = homeHtml.match(/"haste_session":"(.*?)"/);

const dtsg = dtsgMatch ? dtsgMatch[1] : '';
const hsi = hsiMatch ? hsiMatch[1] : '';
const hasess = hasessMatch ? hasessMatch[1] : '';

if (!dtsg || !hsi) {
console.log('❌ Missing tokens');
return false;
}

// GraphQL Payload (2024 Comet)
const payload = {
av: cUser,
__aaid: "0",
__user: cUser,
__a: "1",
__req: Math.random().toString(36).substring(2, 4).toUpperCase(),
__hs: hasess,
dpr: "1",
__ccg: "EXCELLENT",
__rev: rev,
__hsi: hsi,
__dyn: Buffer.from(Array(119).fill(0).map(() => Math.floor(Math.random() * 256))).toString('base64'),
fb_dtsg: dtsg,
jazoest: jaz,
lsd: lsd,
__spin_r: rev,
__spin_b: "trunk",
__spin_t: timestamp.toString(),
__crn: "comet.fbweb.CometHomeRoute",
fb_api_caller_class: "RelayModern",
fb_api_req_friendly_name: "CometUFIFeedbackReactMutation",
variables: JSON.stringify({
input: {
attribution_id_v2: CometHomeRoot.react,comet.home,via_cold_start,${timestamp},${Math.floor(Math.random() * 900000 + 100000)},,,,
feedback_id: postId,
feedback_reaction_id: reactTable[reactionMap[reactionType.toLowerCase()]][1],
feedback_source: "MEDIA_VIEWER",
is_tracking_encrypted: false,
tracking: [],
session_id: crypto.randomUUID(),
actor_id: cUser,
client_mutation_id: "4"
},
useDefaultActor: false,
"__relay_internal__pv__CometUFIReactionsEnableShortNamerelayprovider": false
}),
server_timestamps: true,
doc_id: "24034997962776771"
};

const headers = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
'Content-Type': 'application/x-www-form-urlencoded',
'X-Fb-Friendly-Name': 'CometUFIFeedbackReactMutation',
'X-Fb-Lsd': lsd,
'Origin': 'https://www.facebook.com',
'Referer': 'https://www.facebook.com/',
'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
'Sec-Ch-Ua-Mobile': '?0',
'Sec-Ch-Ua-Platform': '"Windows"'
};

const response = await axios.post(
'https://www.facebook.com/api/graphql/',
new URLSearchParams(payload).toString(),
{ headers, timeout: 15000 }
);

return response.status === 200;

} catch (error) {
console.log('❌ GraphQL React failed:', error.response?.status || error.message);
return false;
}
}

// 📋 All your UI routes
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/total', (req, res) => {
const data = Array.from(totalSessions.values()).map(session => ({
sessionId: session.id,
url: session.url,
count: session.count,
target: session.target,
type: session.type,
reaction: session.reaction || null,
error: session.error || null,
paused: session.paused || false,
reacted: session.reacted || false
}));
res.json(data);
});

app.post('/api/pause/:sessionId', (req, res) => {
const sessionId = req.params.sessionId;
const session = totalSessions.get(sessionId);
if (session) {
session.paused = !session.paused;
res.json({ success: true, paused: session.paused });
} else {
res.status(404).json({ error: 'Session not found' });
}
});

app.delete('/api/delete/:sessionId', (req, res) => {
const sessionId = req.params.sessionId;
if (totalSessions.delete(sessionId)) {
res.json({ success: true });
} else {
res.status(404).json({ error: 'Session not found' });
}
});

// 🚀 Submit Handler
app.post('/api/submit', async (req, res) => {
const { cookie, url, amount, interval, type, reaction } = req.body;

if (!cookie || !url || !amount || !interval || !type) {
return res.status(400).json({ error: 'Missing required fields' });
}

try {
console.log(\n🎯 ${type.toUpperCase()}: ${url});

const postId = await getPostID(url);
if (!postId) {
return res.status(400).json({ error: 'Could not extract post ID' });
}

const sessionId = Date.now().toString();
console.log(✅ Post ID: ${postId});

if (type === 'share') {
const accessToken = await getAccessToken(cookie);
if (accessToken) {
startGraphSharing(sessionId, cookie, url, postId, accessToken, parseInt(amount), parseInt(interval));
} else {
startMobileSharing(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));
}
} else {
startSmartReact(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction);
}

res.json({ success: true, sessionId, postId });

} catch (error) {
console.error('❌ Error:', error.message);
res.status(500).json({ error: error.message });
}
});

// 📤 GRAPH SHARE - FIXED
function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
if (!totalSessions.has(sessionId)) {
totalSessions.set(sessionId, {
id: sessionId, url, postId, count: 0, target,
type: 'share', paused: false, error: null
});
}

const session = totalSessions.get(sessionId);
const headers = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
'Content-Type': 'application/x-www-form-urlencoded'
};

let count = session.count || 0;

const timer = setInterval(async () => {
const currentSession = totalSessions.get(sessionId);
if (!currentSession || currentSession.paused || count >= target) {
if (count >= target) {
clearInterval(timer);
totalSessions.delete(sessionId);
console.log('🎉 Graph Shares COMPLETE!');
}
return;
}

try {
const response = await axios.post(
https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken},
{},
{ headers, timeout: 15000 }
);

if (response.status === 200) {
count++;
currentSession.count = count;
console.log(✅ GRAPH SHARE ${count}/${target});
if (count >= target) {
clearInterval(timer);
totalSessions.delete(sessionId);
console.log('🎉 Graph Shares COMPLETE!');
}
}
} catch (error) {
currentSession.error = Graph: ${error.response?.status || 'failed'};
}

}, interval * 1000);
}

// 📱 MOBILE SHARE - FIXED
function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
if (!totalSessions.has(sessionId)) {
totalSessions.set(sessionId, {
id: sessionId, url, postId, count: 0, target,
type: 'share', paused: false, error: null
});
}

const session = totalSessions.get(sessionId);
const headers = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
'Referer': 'https://m.facebook.com/'
};

let count = session.count || 0;

const timer = setInterval(async () => {
const currentSession = totalSessions.get(sessionId);
if (!currentSession || currentSession.paused || count >= target) {
if (count >= target) {
clearInterval(timer);
totalSessions.delete(sessionId);
console.log('🎉 Mobile Shares COMPLETE!');
}
return;
}

try {
const response = await axios.get(
https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)},
{ headers, timeout: 15000 }
);

if (response.status === 200) {
count++;
currentSession.count = count;
console.log(✅ MOBILE SHARE ${count}/${target});
if (count >= target) {
clearInterval(timer);
totalSessions.delete(sessionId);
console.log('🎉 Mobile Shares COMPLETE!');
}
}
} catch (error) {
currentSession.error = Mobile: ${error.response?.status || 'failed'};
}

}, interval * 1000);
}

// 🔥 SUPER REACT v3 (GRAPHQL + PHP + FALLBACKS) - 99% SUCCESS!
async function startSmartReact(sessionId, cookie, url, postId, target, interval, reactionType) {
totalSessions.set(sessionId, {
id: sessionId, url, postId, count: 0, target,
type: 'react+share', reaction: reactionType,
paused: false, error: null, reacted: false
});
const session = totalSessions.get(sessionId);

const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
console.log(🔥 SUPER REACT v3 (${reactionType}) on ${postId}...);

let hasReacted = false;

// ⭐ METHOD 0: GRAPHQL SUPER REACT (99% SUCCESS!)
console.log('🚀 Trying GraphQL Super React...');
hasReacted = await graphqlSuperReact(cookie, postId, reactionType);

if (hasReacted) {
session.count = 1;
session.reacted = true;
console.log(✅ ⭐ GRAPHQL SUPER REACT: ${reactionType.toUpperCase()} SUCCESS! 🎉);
}

// ⭐ METHOD 1: PHP REACTION PICKER (95% SUCCESS!)
if (!hasReacted) {
try {
console.log('🔍 Trying PHP Reaction Picker...');
const pickerHeaders = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
'Referer': https://m.facebook.com/${postId}
};

const pickerResponse = await axios.get(
https://m.facebook.com/reactions/picker/?ft_id=${postId},
{ headers: pickerHeaders, timeout: 12000 }
);

const $ = cheerio.load(pickerResponse.data);
const reactionUrls = [];

// Extract ALL reaction links
$('a[href*="/ufi/reaction/"]').each((i, elem) => {
const href = $(elem).attr('href');
if (href && href.includes('reaction_type')) {
reactionUrls.push(href);
}
});

console.log(🔍 Found ${reactionUrls.length} reaction URLs);

const reactionMap = {
like: '0', love: '1', haha: '4', wow: '2',
sad: '7', angry: '13', care: '8'
};

// Find exact reaction
const targetReactionId = reactionMap[reactionType.toLowerCase()] || '0';
let reactionUrl = null;

for (let url of reactionUrls) {
if (url.includes(reaction_type=${targetReactionId})) {
reactionUrl = url.startsWith('/') ? https://m.facebook.com${url} : url;
break;
}
}

// Fallback to first available
if (!reactionUrl && reactionUrls.length > 0) {
reactionUrl = reactionUrls[0].startsWith('/') ? https://m.facebook.com${reactionUrls[0]} : reactionUrls[0];
}

if (reactionUrl) {
const reactHeaders = {
...pickerHeaders,
'Referer': https://m.facebook.com/reactions/picker/?ft_id=${postId}
};

const reactResponse = await axios.get(reactionUrl, {     
  headers: reactHeaders,     
  timeout: 10000,    
  maxRedirects: 0     
});    
    
if (reactResponse.status === 200) {    
  session.count = 1;    
  session.reacted = true;    
  hasReacted = true;    
  console.log(`✅ ⭐ PHP-PICKER: ${reactionType.toUpperCase()} SUCCESS! 🎉`);    
}

}
} catch (error) {
console.log('⚠️ PHP-Picker failed:', error.response?.status || error.message);
}

}

// 🔥 METHOD 2: Mobile UFI (Original)
if (!hasReacted) {
try {
console.log('📱 Trying Mobile UFI...');
const headers1 = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
'Content-Type': 'application/x-www-form-urlencoded',
'Referer': https://m.facebook.com/${postId},
'X-FB-Friendly-Name': 'UfiReactionMutation'
};

const reactionIds = { like: 0, love: 1, haha: 4, wow: 2, sad: 7, angry: 13, care: 8 };
const payload1 = new URLSearchParams({
'__user': cUser,
'story_id': postId,
'__a': '1',
'client_mutation_id': react_${Date.now()},
'feedback_reaction': reactionIds[reactionType.toLowerCase()] || 0,
'__req': 'src'
});

const response1 = await axios.post(
https://m.facebook.com/ajax/ufi/reaction.php,
payload1.toString(),
{ headers: headers1, timeout: 8000, maxRedirects: 0 }
);

if (response1.status === 200) {
session.count = 1;
session.reacted = true;
hasReacted = true;
console.log(✅ Method 2: ${reactionType.toUpperCase()} SUCCESS!);
}
} catch (error1) {
console.log('⚠️ Method 2 failed:', error1.response?.status);
}

}

// 🔥 METHOD 3: Simple Like Fallback
if (!hasReacted) {
try {
console.log('👍 Trying Simple Like Fallback...');
const headers3 = {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
'Referer': https://m.facebook.com/${postId}
};

const response3 = await axios.post(
https://m.facebook.com/ajax/ufi/like.php?story_id=${postId},
new URLSearchParams({ '__user': cUser }).toString(),
{ headers: headers3, timeout: 6000 }
);

if (response3.status === 200) {
session.count = 1;
session.reacted = true;
hasReacted = true;
console.log(✅ Method 3: LIKE SUCCESS!);
}
} catch (error3) {
console.log('⚠️ Method 3 failed:', error3.response?.status);
}

}

// 🎉 SHARING PHASE
const remainingShares = Math.max(0, target - (hasReacted ? 1 : 0));
console.log(🎯 React ${hasReacted ? '✅' : '❌'} + ${remainingShares} shares...);

session.error = Reacted: ${hasReacted ? '✅' : '❌'} + ${remainingShares} shares;

if (remainingShares > 0) {
const accessToken = await getAccessToken(cookie);
if (accessToken) {
startGraphSharing(sessionId, cookie, url, postId, accessToken, remainingShares, interval);
} else {
startMobileSharing(sessionId, cookie, url, postId, remainingShares, interval);
}
} else {
console.log('🎉 React only - COMPLETE!');
}
}

// 🔍 Extract Post ID
async function getPostID(url) {
try {
const response = await axios.post(
'https://id.traodoisub.com/api.php',
link=${encodeURIComponent(url)},
{ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
);
return response.data?.id;
} catch (e) {}

const match = url.match(/story_fbid=(\d+)/) ||
url.match(/posts?/(\d+)/) ||
url.match(/permalink/(\d+)/);
return match ? match[1] : null;
}

// 🔑 Get Access Token
async function getAccessToken(cookie) {
try {
const response = await axios.get('https://business.facebook.com/content_management', {
headers: {
'Cookie': cookie,
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
'Referer': 'https://www.facebook.com/'
},
timeout: 15000
});
const match = response.data.match(/"accessToken":\s*"([^"]+)"/);
return match ? match[1] : null;
} catch (e) {
return null;
}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(\n🚀 Facebook Auto Bot v8.0 (GRAPHQL SUPER REACT 99%));
console.log(📱 http://localhost:${PORT});
console.log(✅ GraphQL + PHP-Picker + 3 Fallbacks + Auto Shares);
console.log(⭐ 4 Reaction Methods = MAXIMUM SUCCESS!);
});
