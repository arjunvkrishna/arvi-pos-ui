import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { tabFromHash } from '../auth/tabs';

/**
 * The classic app addressed screens by URL hash (#menu, #tab-menu). Old bookmarks and links keep working: the hash is
 * translated into the matching route (also when it changes while the app is open) and then removed from the address bar.
 */
export function HashBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const apply = () => {
      const tab = tabFromHash(window.location.hash);
      if (!tab) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);
      navigate(`/${tab}`, { state: { fromLink: true } });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [navigate]);
  return null;
}
