const express = require('express');

const router = express.Router();

const previewCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 256 * 1024;

function normalizeHttpUrl(value) {
  if (!value) return '';

  try {
    const parsed = new URL(String(value).trim());
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
}

function parseMetaTag(html, key, attr = 'property') {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${escapedKey}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${escapedKey}["'][^>]*>`,
    'i'
  );

  const match = html.match(pattern);
  if (!match) return '';
  return String(match[1] || match[2] || '').trim();
}

function parseTitleTag(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return '';
  return String(titleMatch[1] || '').replace(/\s+/g, ' ').trim();
}

function resolveOptionalUrl(value, baseUrl) {
  if (!value) return '';

  try {
    const resolved = new URL(value, baseUrl).toString();
    const protocol = new URL(resolved).protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return '';
    return resolved;
  } catch (_) {
    return '';
  }
}

function buildFallbackPreview(url) {
  try {
    const parsed = new URL(url);
    return {
      url,
      siteName: parsed.hostname.replace(/^www\./i, ''),
      title: parsed.hostname,
      description: '',
      image: ''
    };
  } catch (_) {
    return {
      url,
      siteName: 'Link',
      title: url,
      description: '',
      image: ''
    };
  }
}

async function fetchPreviewHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'ZapMessengerBot/1.0 (+https://zap.local)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return null;
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) {
      return null;
    }

    const html = await response.text();
    if (!html) return null;

    return {
      finalUrl: normalizeHttpUrl(response.url) || url,
      html: html.slice(0, MAX_HTML_BYTES)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getCachedPreview(url) {
  const cached = previewCache.get(url);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    previewCache.delete(url);
    return null;
  }

  return cached.payload;
}

router.get('/', async (req, res) => {
  const inputUrl = String(req.query.url || '').trim();

  if (!inputUrl || inputUrl.length > MAX_URL_LENGTH) {
    return res.status(400).json({
      code: 'INVALID_INPUT',
      message: 'A valid url query is required.'
    });
  }

  const normalized = normalizeHttpUrl(inputUrl);
  if (!normalized) {
    return res.status(400).json({
      code: 'INVALID_INPUT',
      message: 'Only http and https URLs are supported.'
    });
  }

  const cached = getCachedPreview(normalized);
  if (cached) {
    return res.json(cached);
  }

  try {
    const fetched = await fetchPreviewHtml(normalized);
    if (!fetched) {
      const fallback = buildFallbackPreview(normalized);
      previewCache.set(normalized, { payload: fallback, timestamp: Date.now() });
      return res.json(fallback);
    }

    const { html, finalUrl } = fetched;
    const title = parseMetaTag(html, 'og:title') || parseTitleTag(html) || '';
    const description = parseMetaTag(html, 'og:description') || parseMetaTag(html, 'description', 'name') || '';
    const siteName = parseMetaTag(html, 'og:site_name') || '';
    const image = resolveOptionalUrl(parseMetaTag(html, 'og:image'), finalUrl);

    const payload = {
      url: finalUrl,
      siteName: siteName || buildFallbackPreview(finalUrl).siteName,
      title: title || buildFallbackPreview(finalUrl).title,
      description,
      image
    };

    previewCache.set(normalized, {
      payload,
      timestamp: Date.now()
    });

    return res.json(payload);
  } catch (_) {
    const fallback = buildFallbackPreview(normalized);
    return res.json(fallback);
  }
});

module.exports = router;
