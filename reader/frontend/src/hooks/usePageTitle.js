import { useEffect } from 'react';

const SITE = 'Reader';

/** Sets the browser tab title for the current page. */
const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} — Track, discover and discuss books`;
  }, [title]);
};

export default usePageTitle;
