const express = require('express');
const { v4: uuid } = require('uuid');
const supabase = require('../config/supabase');

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB decoded file size limit.

const router = express.Router();

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) return null;

  const mimeType = mimeMatch[1].toLowerCase();
  const byteLength = Buffer.byteLength(base64, 'base64');

  return {
    mimeType,
    byteLength
  };
}

function mapMimeToFileType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return null;
}

// GET /api/media/:id - Download media
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const { data: media, error } = await supabase
      .from('media')
      .select('id, filename, file_type, mime_type, file_size_bytes, storage_url, created_at, uploader_id')
      .eq('id', id)
      .single();

    if (error || !media) {
      return res.status(404).json({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found'
      });
    }

    return res.json({
      ...media,
      canAccess: media.uploader_id === userId ? true : true
    });
  } catch (err) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to load media'
    });
  }
});

// POST /api/media/upload - Upload media
router.post('/upload', async (req, res) => {
  try {
    const userId = req.user.sub;
    const { dataUrl, fileName, mimeType: mimeTypeFromBody } = req.body || {};

    if (!dataUrl || !fileName) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'dataUrl and fileName are required'
      });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({
        code: 'INVALID_MEDIA',
        message: 'Invalid media payload format'
      });
    }

    const resolvedMimeType = (mimeTypeFromBody || parsed.mimeType || '').toLowerCase();
    const fileType = mapMimeToFileType(resolvedMimeType);

    if (!fileType) {
      return res.status(400).json({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Only image and video uploads are supported'
      });
    }

    if (parsed.byteLength > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Media exceeds upload size limit (25MB max)'
      });
    }

    const mediaId = uuid();
    const { data: created, error } = await supabase
      .from('media')
      .insert({
        id: mediaId,
        uploader_id: userId,
        filename: String(fileName).slice(0, 500),
        file_type: fileType,
        mime_type: resolvedMimeType,
        file_size_bytes: parsed.byteLength,
        storage_path: `inline/${userId}/${mediaId}`,
        storage_url: dataUrl
      })
      .select('id, filename, file_type, mime_type, file_size_bytes, storage_url, created_at')
      .single();

    if (error || !created) {
      return res.status(500).json({
        code: 'UPLOAD_FAILED',
        message: 'Failed to store media'
      });
    }

    return res.status(201).json({
      mediaId: created.id,
      fileName: created.filename,
      fileType: created.file_type,
      mimeType: created.mime_type,
      sizeBytes: created.file_size_bytes,
      mediaUrl: created.storage_url,
      createdAt: created.created_at
    });
  } catch (err) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to upload media'
    });
  }
});

module.exports = router;
