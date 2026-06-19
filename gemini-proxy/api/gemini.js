const ALLOWED_ORIGINS = [
    'https://klookermediavn.com',
    'https://www.klookermediavn.com'
];

// Free tier, vision + tiếng Việt tốt hơn flash-lite
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_VISION_BATCH = Number(process.env.MAX_VISION_BATCH || 10);

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return await new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(raw || '{}')); }
            catch { resolve({}); }
        });
    });
}

async function callGemini(apiKey, contents) {
    return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: contents }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json'
                }
            })
        }
    );
}

function parseGeminiJson(text) {
    try { return JSON.parse(text); }
    catch { return {}; }
}

async function geminiRequest(apiKey, parts) {
    const geminiRes = await callGemini(apiKey, parts);
    if (!geminiRes.ok) {
        const detail = await geminiRes.text();
        const err = new Error('Gemini API error');
        err.status = geminiRes.status;
        err.detail = detail;
        throw err;
    }
    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return parseGeminiJson(text);
}

async function handleDescribe(apiKey, image) {
    if (!image?.id || !image?.data) {
        return { description: '', tags: [] };
    }

    const parsed = await geminiRequest(apiKey, [{
        text: `Mô tả ảnh để tìm kiếm thư viện Drive. File: "${image.name || ''}".

Trả JSON: {"description":"1-2 câu tiếng Việt","tags":["tag1","tag2"]}

Tags phải gồm: chủ đề chính, text/chữ trong ảnh (nếu có), loại nội dung (quảng cáo, menu, sự kiện, giấy tờ, screenshot...).`
    }, {
        inline_data: {
            mime_type: image.mimeType || 'image/jpeg',
            data: image.data
        }
    }]);

    return {
        id: image.id,
        description: String(parsed.description || '').slice(0, 500),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 25) : []
    };
}

async function handleMatch(apiKey, query, images) {
    const safeImages = images.filter((item) => item?.id && item?.data).slice(0, MAX_VISION_BATCH);
    if (!safeImages.length) {
        return { matches: [], summary: 'Khong co anh de xac minh.' };
    }

    const parts = [{
        text: `Người dùng tìm: "${query}"

Xem ${safeImages.length} ảnh dưới đây. CHỈ chọn ảnh thật sự liên quan đến mô tả.
LOẠI BỎ: giấy tờ, ghi chú tay, screenshot cuộc gọi, bảng biểu không liên quan, ảnh chỉ vì có 1 từ trùng ngẫu nhiên.

Trả JSON: {"matches":[{"id":"...","score":7-10,"reason":"ngắn"}],"summary":"..."}
Chỉ id score >= 7. Không khớp thì matches rỗng.`
    }];

    safeImages.forEach((item, index) => {
        parts.push({ text: `[${index + 1}] id=${item.id} file="${item.name}"` });
        parts.push({
            inline_data: {
                mime_type: item.mimeType || 'image/jpeg',
                data: item.data
            }
        });
    });

    const parsed = await geminiRequest(apiKey, parts);
    const matches = Array.isArray(parsed.matches)
        ? parsed.matches.filter((m) => m?.id && Number(m.score) >= 7)
        : [];

    return {
        matches,
        summary: parsed.summary || '',
        model: GEMINI_MODEL
    };
}

module.exports = async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Server chua cau hinh GEMINI_API_KEY' }));
    }

    try {
        const body = await readJsonBody(req);
        res.setHeader('Content-Type', 'application/json');

        if (body.mode === 'describe' && body.image) {
            const result = await handleDescribe(apiKey, body.image);
            res.statusCode = 200;
            return res.end(JSON.stringify({ ...result, model: GEMINI_MODEL }));
        }

        if (body.mode === 'match' && body.query && Array.isArray(body.images) && body.images.length) {
            const result = await handleMatch(apiKey, body.query, body.images);
            res.statusCode = 200;
            return res.end(JSON.stringify(result));
        }

        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Mode khong hop le' }));
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        if (error.status) {
            res.statusCode = 502;
            return res.end(JSON.stringify({ error: error.message, status: error.status, detail: error.detail, model: GEMINI_MODEL }));
        }
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: error.message || 'Loi xu ly' }));
    }
};
