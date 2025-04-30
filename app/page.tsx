"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function Page() {
  const [clickCount, setClickCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  const handleSecretClick = () => {
    setClickCount((prev) => {
      const next = prev + 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setClickCount(0), 3000);

      if (next >= 5) {
        router.push('/login');
      }
      return next;
    });
  };

  // 5秒後にボタンを透明にする
  useEffect(() => {
    const timer = setTimeout(() => setHidden(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-8 text-center relative">
      <h1 className="text-2xl font-bold">ようこそ NovaTrail へ</h1>
      <p className="mt-2 text-gray-600">こちらはサッカー試合情報の可視化アプリです。</p>

      {/* 隠しボタン */}
      <button
        onClick={handleSecretClick}
        className={`absolute bottom-10 right-10 w-24 h-24 rounded-lg transition-opacity duration-1000 ${
          hidden ? 'opacity-0' : 'border-2 border-dashed border-blue-500 bg-white/10'
        }`}
        aria-label="Secret Login Trigger"
      />
    </div>
  );
}
