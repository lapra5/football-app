'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [clickCount, setClickCount] = useState(0);

  const handleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      router.push('/login');
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">ようこそ NovaTrail へ</h1>
        <p>こちらはサッカー試合情報の可視化アプリです。</p>
      </div>

      {/* 🟥 一時的に見える隠しボタン */}
      <div
        className="absolute top-10 left-10 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer shadow-lg"
        onClick={handleClick}
        title="5回クリックでログインへ"
      >
        Tap
      </div>
    </div>
  );
}
