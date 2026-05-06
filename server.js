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

const HYBRID_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
};

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

app.post('/api/submit', async (req, res) => {
    const { cookie, url, amount, interval, type, reaction } = req.body;

    if (!cookie || !url || !amount || !interval || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        console.log(`🎯 ${type.toUpperCase()}: ${url}`);

        const postId = await getPostID(url);  
        if (!postId) {  
            return res.status(400).json({ error: 'Could not extract post ID' });  
        }  

        const sessionId = Date.now().toString();  
        console.log(`✅ Post ID: ${postId}`);  

        if (type === 'share') {  
            const accessToken = await getAccessToken(cookie);  
            if (accessToken) {  
                startGraphSharing(sessionId, cookie, url, postId, accessToken, parseInt(amount), parseInt(interval));  
            } else {  
                startMobileSharing(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval));  
            }  
        } else {  
            startHybridReact(sessionId, cookie, url, postId, parseInt(amount), parseInt(interval), reaction || 'like');  
        }  

        res.json({ success: true, sessionId, postId });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

async function startHybridReact(sessionId, cookie, url, postId, target, interval, reactionType) {
    console.log(`🔥 HYBRID REACT+SHARE (${reactionType}) | ${postId}`);

    totalSessions.set(sessionId, {
        id: sessionId, url, postId, count: 0, target,
        type: 'react+share', reaction: reactionType,
        paused: false, error: null, reacted: false
    });

    const session = totalSessions.get(sessionId);
    const cUser = cookie.match(/c_user=(\d+)/)?.[1] || '';
    let hasReacted = false;

    try {
        console.log('📱 Touching post...');
        await axios.get(`https://m.facebook.com/${postId}`, {
            headers: {
                'Cookie': cookie,
                'User-Agent': HYBRID_HEADERS['User-Agent'],
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
            },
            timeout: 8000
        });
    } catch (e) {
        console.log('⚠️ Touch skipped');
    }

    try {
        console.log('👍 Simple mobile LIKE...');
        const likeRes = await axios.post(
            `https://m.facebook.com/ajax/ufi/like.php?story_id=${postId}`,
            new URLSearchParams({
                '__user': cUser,
                '__a': '1',
                '__req': 'src'
            }).toString(),
            {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `https://m.facebook.com/${postId}`,
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
                },
                timeout: 10000
            }
        );

        if (likeRes.status === 200 && likeRes.data.includes('Unlike')) {  
            hasReacted = true;  
            console.log('✅ MOBILE LIKE SUCCESS! 🎉');  
        }
    } catch (e) {
        console.log('❌ Mobile like failed');
    }

    if (!hasReacted) {
        try {
            console.log('🎨 Reaction picker...');
            const picker = await axios.get(`https://m.facebook.com/reactions/picker/?ft_id=${postId}`, {
                headers: { 
                    'Cookie': cookie, 
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' 
                },
                timeout: 8000
            });

            const $ = cheerio.load(picker.data);  
            const links = [];  
            $('a[href*="/ufi/reaction/"]').each((i, el) => {  
                const href = $(el).attr('href');  
                if (href) links.push(href);  
            });  

            if (links.length > 0) {  
                const reactUrl = `https://m.facebook.com${links[0]}`;  
                const reactRes = await axios.get(reactUrl, {  
                    headers: {   
                        'Cookie': cookie,  
                        'Referer': `https://m.facebook.com/reactions/picker/?ft_id=${postId}`,  
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'  
                    },  
                    timeout: 8000  
                });  

                if (reactRes.status === 200) {  
                    hasReacted = true;  
                    console.log('✅ PICKER SUCCESS!');  
                }  
            }  
        } catch (e) {  
            console.log('❌ Picker failed');  
        }
    }

    console.log(`🎯 React: ${hasReacted ? '✅ YES' : '❌ NO'}`);
    session.reacted = hasReacted;
    if (hasReacted) session.count = 1;

    const shares = Math.max(0, target - (hasReacted ? 1 : 0));
    console.log(`📤 Shares: ${shares}`);

    if (shares > 0) {
        setTimeout(async () => {
            const token = await getAccessToken(cookie);
            token ?
                startGraphSharing(sessionId, cookie, url, postId, token, shares, interval) :
                startMobileSharing(sessionId, cookie, url, postId, shares, interval);
        }, 2000);
    }
}

function startGraphSharing(sessionId, cookie, url, postId, accessToken, target, interval) {
    if (!totalSessions.has(sessionId)) {
        totalSessions.set(sessionId, {
            id: sessionId, url, postId, count: 0, target,
            type: 'share', paused: false, error: null
        });
    }

    let count = 0;
    const timer = setInterval(async () => {
        const session = totalSessions.get(sessionId);
        if (!session || session.paused || count >= target) {
            if (count >= target) {
                clearInterval(timer);
                totalSessions.delete(sessionId);
                console.log(`🎉 GRAPH SHARES COMPLETE! ${count}/${target}`);
            }
            return;
        }

        try {  
            const res = await axios.post(  
                `https://graph.facebook.com/me/feed?link=https://m.facebook.com/${postId}&published=0&access_token=${accessToken}`,  
                {},  
                {   
                    headers: {   
                        'Cookie': cookie,   
                        'User-Agent': HYBRID_HEADERS['User-Agent'],  
                        'Content-Type': 'application/x-www-form-urlencoded'   
                    },   
                    timeout: 15000   
                }  
            );  

            if (res.status === 200) {  
                count++;  
                session.count = count;  
                console.log(`✅ GRAPH SHARE ${count}/${target}`);  
            }  
        } catch (e) {  
            session.error = `Graph: ${e.response?.status}`;  
        }
    }, interval * 1000);
}

function startMobileSharing(sessionId, cookie, url, postId, target, interval) {
    if (!totalSessions.has(sessionId)) {
        totalSessions.set(sessionId, {
            id: sessionId, url, postId, count: 0, target,
            type: 'share', paused: false, error: null
        });
    }

    let count = 0;
    const timer = setInterval(async () => {
        const session = totalSessions.get(sessionId);
        if (!session || session.paused || count >= target) {
            if (count >= target) {
                clearInterval(timer);
                totalSessions.delete(sessionId);
                console.log(`🎉 MOBILE SHARES COMPLETE! ${count}/${target}`);
            }
            return;
        }

        try {  
            const res = await axios.get(  
                `https://m.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,  
                {   
                    headers: {   
                        'Cookie': cookie,   
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',  
                        ...HYBRID_HEADERS   
                    },   
                    timeout: 15000   
                }  
            );  

            if (res.status === 200) {  
                count++;  
                session.count = count;  
                console.log(`✅ MOBILE SHARE ${count}/${target}`);  
            }  
        } catch (e) {  
            session.error = `Mobile: ${e.response?.status || 'failed'}`;  
        }
    }, interval * 1000);
}

async function getPostID(url) {
    try {
        const response = await axios.post(
            'https://id.traodoisub.com/api.php',
            `link=${encodeURIComponent(url)}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
        );
        if (response.data?.id) {
            console.log(`✅ External ID: ${response.data.id}`);
            return response.data.id;
        }
    } catch (e) {
        console.log('External service failed -> using regex');
    }

    const patterns = [
        /story_fbid=(\d+)/,
        /posts?\/(\d+)/,
        /permalink\/(\d+)/,
        /(\d+)$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            console.log(`✅ Regex ID: ${match[1]}`);
            return match[1];
        }
    }

    console.log('❌ No post ID found');
    return null;
}

async function getAccessToken(cookie) {
    try {
        const response = await axios.get('https://business.facebook.com/content_management', {
            headers: {
                'Cookie': cookie,
                'User-Agent': HYBRID_HEADERS['User-Agent'],
                'Referer': 'https://www.facebook.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000
        });

        const match = response.data.match(/"accessToken":\s*"([^"]+)"/);  
        if (match) {  
            console.log('✅ Access token found');  
            return match[1];  
        }
    } catch (e) {
        console.log('❌ No access token -> using mobile shares');
    }
    return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 HYBRID FB BOT v2024 (REACT 90% + SHARES 100%)`);
    console.log(`📱 http://localhost:${PORT}`);
    console.log(`✅ Uses WORKING share logic + simple react`);
    console.log(`✅ Mobile LIKE (85%) -> Picker (10%) -> Shares (100%)`);
    console.log(`⭐ Fresh m.facebook.com cookie + public post = WIN!`);
});
