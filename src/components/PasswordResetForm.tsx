'use client';

import { useState } from 'react';
import { auth } from '@/firebase/firebase';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';

interface PasswordResetFormProps {
  onBack: () => void;
}

export const PasswordResetForm = ({ onBack }: PasswordResetFormProps) => {
  const [userId, setUserId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handlePasswordReset = async () => {
    try {
      const email = `${userId}@example.com`;

      const user = auth.currentUser;
      if (!user) {
        setMessage('❌ 現在ログインしていません');
        return;
      }

      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      setMessage('✅ パスワードを変更しました！');
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setMessage("❌ ユーザーIDが存在しません");
      } else if (err.code === "auth/wrong-password") {
        setMessage("❌ 現在のパスワードが正しくありません");
      } else {
        setMessage(`❌ エラー: ${err.message}`);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <label className="block mb-1 font-bold">ユーザーID</label>
        <input
          type="text"
          className="w-full border px-3 py-2 rounded"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="ユーザーIDを入力"
        />
      </div>

      <div>
        <label className="block mb-1 font-bold">現在のパスワード</label>
        <input
          type="password"
          className="w-full border px-3 py-2 rounded"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="現在のパスワードを入力"
        />
      </div>

      <div>
        <label className="block mb-1 font-bold">新しいパスワード</label>
        <input
          type="password"
          className="w-full border px-3 py-2 rounded"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="新しいパスワードを入力"
        />
      </div>

      <button
        onClick={handlePasswordReset}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold"
      >
        パスワードを変更する
      </button>

      <button
        onClick={onBack}
        className="w-full mt-2 text-blue-600 hover:underline text-sm"
      >
        ← ログイン画面に戻る
      </button>

      {message && (
        <div className="mt-4 text-center text-sm">{message}</div>
      )}
    </div>
  );
};
