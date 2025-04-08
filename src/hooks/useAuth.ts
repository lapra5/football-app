import { useState, useEffect } from 'react';
import { auth } from '@/firebase/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { useRouter } from 'next/navigation'; // App Router 対応用

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      const idTokenResult = await userCredential.user.getIdTokenResult();
      return idTokenResult.claims.admin === true;  // ← ここを修正！！
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('ユーザーが見つかりません。');
      } else if (err.code === 'auth/wrong-password') {
        setError('パスワードが間違っています。');
      } else {
        setError('ログインに失敗しました。');
      }
      console.error(err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };  

  const signup = async (email: string, password: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
    } catch (err: any) {
      setError('新規登録に失敗しました。');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const logout = async () => {
    setIsProcessing(true);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      console.error('ログアウトに失敗しました:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return { user, login, signup, logout, error, isProcessing, isInitialized };
};
