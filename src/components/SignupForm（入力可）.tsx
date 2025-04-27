'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export const SignupForm: React.FC = () => {
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { signup, error, isProcessing } = useAuth();

  // 新規登録フォームが表示された時に初期値を空にリセット
  useEffect(() => {
    setNewUserId('');
    setNewPassword('');
  }, []); // 初回レンダリング時にリセット

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = newUserId.includes('@') ? newUserId : `${newUserId}@example.com`;

    if (newPassword.length < 6) {
      alert('パスワードは6文字以上にしてください');
      return;
    }

    try {
      await signup(email, newPassword);
      setNewUserId('');  // 登録後、再度リセット
      setNewPassword(''); // 登録後、再度リセット
    } catch (error) {
      console.error('登録エラー:', error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white p-8 rounded shadow-md h-[400px] flex flex-col justify-between"
    >
      {/* フォームヘッダー */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-center">新規登録</h2>

        {/* ユーザーID */}
        <div className="mb-4">
          <label htmlFor="newUserId" className="block text-sm font-medium text-gray-700">
            ユーザーID
          </label>
          <input
            type="text"
            id="newUserId"
            name="newUserId"
            placeholder="新しいユーザーID"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            autoComplete="off"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {/* パスワード */}
        <div className="mb-6">
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            パスワード
          </label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            placeholder="パスワードを設定"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="off"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <small className="text-gray-500 block mt-1">
            パスワードは6文字以上で設定してください。
          </small>
        </div>
      </div>

      {/* ボタン */}
      <div>
        <button
          type="submit"
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isProcessing ? '登録中...' : '登録'}
        </button>
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </form>
  );
};

