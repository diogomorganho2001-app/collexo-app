import { useState, useEffect } from 'react';
import { onAuthChange } from '../services/auth.js';

/**
 * Returns { user, loading }
 * user is null when signed out, Firebase User object when signed in.
 */
export function useAuth() {
  const [user,    setUser]    = useState(undefined); // undefined = not yet resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(firebaseUser => {
      setUser(firebaseUser ?? null);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
