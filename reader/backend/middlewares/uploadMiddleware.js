const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const ALLOWED_EXTENSIONS = /^\.(jpg|jpeg|png|svg|webp|gif|avif|bmp|ico)$/i;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}-${Date.now()}${ALLOWED_EXTENSIONS.test(ext) ? ext : ''}`);
  },
});

function checkFileType(file, cb) {
  // Require both an image extension and an image MIME type
  const isExtensionValid = ALLOWED_EXTENSIONS.test(path.extname(file.originalname));
  const isImageMime = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');

  if (isExtensionValid && isImageMime) {
    return cb(null, true);
  }
  cb(new Error('Only image files (SVG, PNG, JPG, WEBP, GIF, AVIF) are allowed!'));
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;
