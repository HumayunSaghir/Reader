import { API_URL } from '../api/client';
import { FALLBACK_IMAGE } from '../assets/fallbackImage';

// Open Library covers are served through our API, which caches them: straight
// from Open Library each one takes 5-20 seconds to arrive.
const OPEN_LIBRARY_COVER = /covers\.openlibrary\.org\/b\/id\/(\d+)-[SML]\.jpg/;

/**
 * Image URL for a book cover.
 * size: 'S' (~45px), 'M' (~180px, cards) or 'L' (~500px, large covers)
 */
export const coverUrl = (url, size = 'M') => {
  if (!url) return FALLBACK_IMAGE;
  const match = OPEN_LIBRARY_COVER.exec(url);
  return match ? `${API_URL}/api/covers/${match[1]}-${size}.jpg` : url;
};

/** srcSet giving high-density screens the large cover, others the medium one. */
export const coverSrcSet = (url) => (OPEN_LIBRARY_COVER.test(url || '') ? `${coverUrl(url, 'M')} 1x, ${coverUrl(url, 'L')} 2x` : undefined);

/** onError handler: swap a broken cover for the placeholder. */
export const onCoverError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.removeAttribute('srcset');
  e.currentTarget.src = FALLBACK_IMAGE;
};
