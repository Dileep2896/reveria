import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  auth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from '../firebase';

const AuthContext = createContext();

const TOKEN_REFRESH_MS = 50 * 60 * 1000; // 50 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
      } else {
        setUser(null);
        setIdToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Refresh token periodically; sign out if refresh fails
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const token = await user.getIdToken(true);
        setIdToken(token);
      } catch {
        setUser(null);
        setIdToken(null);
        await auth.signOut();
      }
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, idToken, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
