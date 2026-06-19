const ALLOWED_ORIGINS = [
    'https://klookermediavn.com',
    'https://www.klookermediavn.com'
];

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const MAX_CATALOG = Number(process.env.MAX_CATALOG || 400);
const MAX_RESULTS = Number(process.env.MAX_RESULTS || 100);
const MAX_VISION_IMAGES = Number(process.env.MAX_VISION_IMAGES || 12);

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
                    temperature: 0.15,
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

async function handleVisionSearch(apiKey, query, images) {
    const safeImages = images
        .filter((item) => item && item.id && item.data)
        .slice(0, MAX_VISION_IMAGES);

    if (!safeImages.length) {
        return { matches: [], summary: 'Khong co anh de phan tich.' };
    }

    const parts = [{
        text: `Bạn là trợ lý tìm ảnh thông minh. Người dùng mô tả: "${query}"

Dưới đây là ${safeImages.length} ảnh (thumbnail). Hãy NHÌN nội dung từng ảnh: đồ ăn, sự kiện, team, logo, poster, menu, Tết, văn phòng, sản phẩm, text trong ảnh...

Chỉ chọn ảnh THỰC SỰ phù hợp mô tả. Không đoán bừa.
Trả JSON: {"matches":[{"id":"...","score":7-10,"reason":"ngắn tiếng Việt"}],"summary":"tóm tắt kết quả"}
Chỉ gồm id có score >= 7. Tối đa ${MAX_RESULTS} id.`
    }];

    safeImages.forEach((item, index) => {
        parts.push({
            text: `[Ảnh ${index + 1}] id=${item.id} | file="${item.name}" | created=${item.created || 'unknown'}`
        });
        parts.push({
            inline_data: {
                mime_type: item.mimeType || 'image/jpeg',
                data: item.data
            }
        });
    });

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
    const parsed = parseGeminiJson(text);

    const matches = Array.isArray(parsed.matches)
        ? parsed.matches
            .filter((m) => m && m.id && Number(m.score) >= 7)
            .slice(0, MAX_RESULTS)
        : [];

    return {
        matches,
        summary: parsed.summary || (matches.length ? `AI tìm thấy ${matches.length} ảnh phù hợp.` : 'AI không thấy ảnh phù hợp trong lô này.')
    };
}

async function handleCatalogSearch(apiKey, query, catalog) {
    const safeCatalog = catalog.slice(0, MAX_CATALOG).map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        created: item.created || ''
    }));

    const prompt = `Bạn là trợ lý tìm ảnh trong Google Drive.
Người dùng hỏi: "${query}"

Danh sách ảnh (JSON):
${JSON.stringify(safeCatalog)}

Chọn ảnh phù hợp theo tên file, ngày tạo, ngữ cảnh tiếng Việt/Anh.
Trả JSON: {"ids":["id1"],"summary":"..."}
Tối đa ${MAX_RESULTS} id.`;

    const geminiRes = await callGemini(apiKey, [{ text: prompt }]);
    if (!geminiRes.ok) {
        const detail = await geminiRes.text();
        const err = new Error('Gemini API error');
        err.status = geminiRes.status;
        err.detail = detail;
        throw err;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = parseGeminiJson(text);

    return {
        ids: Array.isArray(parsed.ids) ? parsed.ids.slice(0, MAX_RESULTS) : [],
        summary: parsed.summary || ''
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
        const { query, catalog, images, mode } = body;

        if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Thieu query' }));
        }

        res.setHeader('Content-Type', 'application/json');

        if (mode === 'vision' && Array.isArray(images) && images.length) {
            const result = await handleVisionSearch(apiKey, query, images);
            res.statusCode = 200;
            return res.end(JSON.stringify(result));
        }

        if (!Array.isArray(catalog) || !catalog.length) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Thieu catalog hoac images' }));
        }

        const result = await handleCatalogSearch(apiKey, query, catalog);
        res.statusCode = 200;
        return res.end(JSON.stringify(result));
    } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        if (error.status) {
            res.statusCode = 502;
            return res.end(JSON.stringify({ error: error.message, status: error.status, detail: error.detail }));
        }
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: error.message || 'Loi xu ly' }));
    }
};
