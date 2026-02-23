import { useState, useEffect } from 'react';
import { API_URL } from '../utils/storyHelpers';

export default function useUsage(idToken) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/usage`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [idToken]);

  return { data, loading };
}
