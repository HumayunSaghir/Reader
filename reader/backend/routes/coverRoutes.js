const express = require('express');
const { getCover } = require('../services/coverCache');

const router = express.Router();
const IMMUTABLE = 'public, max-age=31536000, immutable';

// GET /api/covers/12539702-M.jpg — Open Library cover, cached on our side
router.get('/:file', async (req, res) => {
  const match = /^(\d{1,12})-([SML])\.jpg$/.exec(req.params.file);
  if (!match) return res.status(404).json({ message: 'Unknown cover' });

  try {
    const cover = await getCover(match[1], match[2]);
    if (!cover) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.status(404).json({ message: 'Cover not found' });
    }
    res.set('Cache-Control', IMMUTABLE);
    res.type('image/jpeg');
    if (cover.file) return res.sendFile(cover.file);
    res.send(cover.buffer);
  } catch (error) {
    console.error(`Cover ${req.params.file} failed:`, error.message);
    // Let the browser fall back to Open Library directly
    res.redirect(302, `https://covers.openlibrary.org/b/id/${match[1]}-${match[2]}.jpg`);
  }
});

module.exports = router;
