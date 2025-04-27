'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export const SignupForm: React.FC = () => {
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { signup, error, isProcessing } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = newUserId.includes('@') ? newUserId : `${newUserId}@example.com`;

    if (newPassword.length < 6) {
      alert('パスワードは6文字以上にしてください');
      return;
    }

    try {
      await signup(email, newPassword);
      setNewUserId('');
      setNewPassword('');
    } catch (error) {
      console.error('登録エラー:', error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white p-8 rounded shadow-md h-[400px] flex flex-col justify-between"
    >
      {/* ✅ フォームヘッダー */}
      <div>
        <h2 className="text-2xl font-bold mb-6 text-center">新規登録</h2>

        {/* ✅ ユーザーID入力欄（停止中） */}
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
            disabled // 入力不可
            autoComplete="off"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
          />
        </div>

        {/* ✅ パスワード入力欄（停止中） */}
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
            disabled // 入力不可
            autoComplete="off"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm"
          />
          <small className="text-gray-400 block mt-1">
            ※現在、新規登録はできません
          </small>
        </div>
      </div>

      {/* ✅ ボタン（停止中） */}
      <div>
        <button
          type="submit"
          disabled // ボタンも無効
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium bg-gray-400 cursor-not-allowed"
        >
          登録（現在停止中）
        </button>
        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </div>
    </form>
  );
};
