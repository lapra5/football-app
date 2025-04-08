import { useEffect, useState } from 'react';
import { auth } from '@/firebase/firebase';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';

export const useAdminCheck = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        setIsAdmin(!!tokenResult.claims.isAdmin);
      } else {
        setIsAdmin(false);
      }
      setChecked(true);
    });

    return () => unsubscribe();
  }, []);

  return { isAdmin, checked };
};
