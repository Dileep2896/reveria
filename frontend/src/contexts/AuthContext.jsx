import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  auth,
  db,
  getDoc,
  doc,
  signInWithPopup,
  GoogleAuthProvider,
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from '../firebase';

const AuthContext = createContext();

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

  // onIdTokenChanged fires on sign-in, sign-out, AND automatic token refresh (~55 min)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
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

  // Returns a valid token (uses cache if fresh, auto-refreshes if expired)
  const getValidToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext.Provider value={{ user, idToken, loading, isAdmin, emailVerified, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, resendVerification, reloadUser, signOut, getValidToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
