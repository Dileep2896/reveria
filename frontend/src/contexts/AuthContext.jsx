import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  auth,
  db,
  getDoc,
  doc,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from '../firebase';

const AuthContext = createContext();

const TOKEN_REFRESH_MS = 50 * 60 * 1000; // 50 minutes

// Check if user needs email verification (email/password provider only)
function needsVerification(firebaseUser) {
  if (!firebaseUser) return false;
  if (firebaseUser.emailVerified) return false;
  // Only require verification for email/password users
  const isEmailProvider = firebaseUser.providerData?.some(p => p.providerId === 'password');
  return !!isEmailProvider;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setEmailVerified(!needsVerification(firebaseUser));
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        // Check admin status
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          setIsAdmin(userDoc.exists() && userDoc.data()?.is_admin === true);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIdToken(null);
        setIsAdmin(false);
        setEmailVerified(true);
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
        setIsAdmin(false);
        await auth.signOut();
      }
    }, TOKEN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signUpWithEmail = useCallback(async (name, email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    // Send verification email
    await sendEmailVerification(cred.user);
    // Force token refresh so displayName is in the token
    await cred.user.getIdToken(true);
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const reloadUser = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      setUser(refreshed);
      setEmailVerified(true);
      const token = await refreshed.getIdToken(true);
      setIdToken(token);
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(async () => {
    setIsAdmin(false);
    setEmailVerified(true);
    await auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, idToken, loading, isAdmin, emailVerified, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, resendVerification, reloadUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
