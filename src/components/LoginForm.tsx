import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { auth } from "@/firebase/firebase";

export const LoginForm: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isProcessing } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = userId.includes('@') ? userId : `${userId}@example.com`;
    console.log("ログインするメールアドレス: ", email);

    try {
      await login(email, password);
      setUserId('');
      setPassword('');

      const currentUser = auth.currentUser;
      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult(true);
        console.log("取得した claims: ", tokenResult.claims);
        const isAdmin = tokenResult.claims.admin === true;
        console.log("管理者判定: ", isAdmin);

        if (isAdmin) {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('ログインエラー:', error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white p-8 rounded shadow-md h-[400px] flex flex-col justify-between"
    >
      <div>
        <h2 className="text-2xl font-bold mb-6 text-center">ログイン</h2>
        <div className="mb-4">
          <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
            ユーザーID
          </label>
          <input
            type="text"
            id="userId"
            placeholder="ユーザーIDを入力"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            disabled={isProcessing}
            autoComplete="username"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            パスワード
          </label>
          <input
            type="password"
            id="password"
            placeholder="パスワードを入力"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isProcessing}
            autoComplete="current-password"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isProcessing}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium ${
            isProcessing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
        >
          {isProcessing ? 'ログイン中...' : 'ログイン'}
        </button>
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </form>
  );
};
