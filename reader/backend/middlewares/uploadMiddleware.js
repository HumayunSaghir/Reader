const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(
      null,
      `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, cb) {
  // Support all standard image extensions: SVG, PNG, JPG, JPEG, WEBP, GIF, AVIF, BMP, ICO
  const allowedExtensions = /\.(jpg|jpeg|png|svg|webp|gif|avif|bmp|ico)$/i;
  const isExtensionValid = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const isImageMime = file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml');

  if (isExtensionValid || isImageMime) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (SVG, PNG, JPG, WEBP, GIF, AVIF) are allowed!'));
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;
