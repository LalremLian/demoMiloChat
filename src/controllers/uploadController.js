const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { success, error } = require('../helpers/response');

// Allowed MIME types per upload category
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-matroska',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

const getUploadDir = () => {
  const dir = process.env.UPLOAD_DIR || './uploads';
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
};

const buildStorage = (subfolder) =>
  multer.diskStorage({
    destination(_req, _file, cb) {
      const dest = path.join(getUploadDir(), subfolder);
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename(_req, file, cb) {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${unique}${ext}`);
    },
  });

const maxFileSizeBytes = () =>
  (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024;

const imageUpload = multer({
  storage: buildStorage('images'),
  limits: { fileSize: maxFileSizeBytes() },
  fileFilter(_req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  },
}).single('file');

const fileUpload = multer({
  storage: buildStorage('files'),
  limits: { fileSize: maxFileSizeBytes() },
  fileFilter(_req, file, cb) {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'File type not allowed'));
    }
  },
}).single('file');

/**
 * Builds the public URL for a stored file.
 * In production, swap this for a CDN URL (S3, CloudFront, etc.).
 */
const buildFileUrl = (req, filePath) => {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const relative = path.relative(uploadDir, filePath).replace(/\\/g, '/');
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${relative}`;
};

// POST /api/uploads/image
const uploadImage = (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return error(res, `Image exceeds maximum size of ${process.env.MAX_FILE_SIZE_MB || 10} MB`, 400);
        }
        return error(res, err.message, 400);
      }
      return next(err);
    }

    if (!req.file) return error(res, 'No file uploaded', 400);

    return success(res, {
      url: buildFileUrl(req, req.file.path),
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  });
};

// POST /api/uploads/file
const uploadFile = (req, res, next) => {
  fileUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return error(res, `File exceeds maximum size of ${process.env.MAX_FILE_SIZE_MB || 10} MB`, 400);
        }
        return error(res, err.message, 400);
      }
      return next(err);
    }

    if (!req.file) return error(res, 'No file uploaded', 400);

    return success(res, {
      url: buildFileUrl(req, req.file.path),
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  });
};

module.exports = { uploadImage, uploadFile };
