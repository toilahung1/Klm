const ALLOWED_ORIGINS = [
    'https://klookermediavn.com',
    'https://www.klookermediavn.com'
];

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_MATCH_BATCH = Number(process.env.MAX_MATCH_BATCH || 16);

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

async function callOpenAI(apiKey, content, maxTokens = 800) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            temperature: 0.1,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content }]
        })
    });

    if (!response.ok) {
        const detail = await response.text();
        const err = new Error('OpenAI API error');
        err.status = response.status;
        err.detail = detail;
        throw err;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    try { return JSON.parse(text); }
    catch { return {}; }
}

function imageContentPart(item, detail = 'low') {
    const mime = item.mimeType || 'image/jpeg';
    return {
        type: 'image_url',
        image_url: {
            url: `data:${mime};base64,${item.data}`,
            detail
        }
    };
}

async function handleDescribe(apiKey, image) {
    if (!image?.id || !image?.data) {
        return { description: '', tags: [] };
    }

    const parsed = await callOpenAI(apiKey, [
        {
            type: 'text',
            text: `Mô tả ảnh để tìm kiếm thư viện Google Drive. File: "${image.name || ''}".
Trả JSON: {"description":"1-2 câu tiếng Việt","tags":["tag1","tag2"]}
Ghi chủ đề, chữ trong ảnh, loại (quảng cáo, menu, sự kiện, giấy tờ, screenshot, giảm cân, team...).`
        },
        imageContentPart(image, 'low')
    ], 400);

    return {
        id: image.id,
        description: String(parsed.description || '').slice(0, 500),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 25) : []
    };
}

async function handleMatch(apiKey, query, images) {
    const safeImages = images.filter((item) => item?.id && item?.data).slice(0, MAX_MATCH_BATCH);
    if (!safeImages.length) {
        return { matches: [], summary: 'Khong co anh de xac minh.', model: OPENAI_MODEL };
    }

    const content = [{
        type: 'text',
        text: `Người dùng tìm: "${query}"

Xem ${safeImages.length} ảnh. CHỈ chọn ảnh THẬT SỰ liên quan (ví dụ "giảm béo" = quảng cáo giảm cân, gym, dinh dưỡng — KHÔNG phải ghi chú tay, cuộc gọi, bảng biểu lạ).

Mỗi ảnh có id trong text ngay trước ảnh đó.
Trả JSON: {"matches":[{"id":"...","score":7-10,"reason":"ngắn tiếng Việt"}],"summary":"..."}
Chỉ score >= 7. Không khớp → matches: [].`
    }];

    safeImages.forEach((item, index) => {
        content.push({
            type: 'text',
            text: `[${index + 1}] id=${item.id} file="${item.name || ''}"`
        });
        content.push(imageContentPart(item, 'low'));
    });

    const parsed = await callOpenAI(apiKey, content, 1200);
    const matches = Array.isArray(parsed.matches)
        ? parsed.matches.filter((m) => m?.id && Number(m.score) >= 7)
        : [];

    return {
        matches,
        summary: parsed.summary || '',
        model: OPENAI_MODEL
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Server chua cau hinh OPENAI_API_KEY' }));
    }

    try {
        const body = await readJsonBody(req);
        res.setHeader('Content-Type', 'application/json');

        if (body.mode === 'describe' && body.image) {
            const result = await handleDescribe(apiKey, body.image);
            res.statusCode = 200;
            return res.end(JSON.stringify({ ...result, model: OPENAI_MODEL }));
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
            return res.end(JSON.stringify({ error: error.message, status: error.status, detail: error.detail, model: OPENAI_MODEL }));
        }
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: error.message || 'Loi xu ly' }));
    }
};
