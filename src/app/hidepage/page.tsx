'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function HiddenPage() {
  const [clickCount, setClickCount] = useState(0);
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const next = clickCount + 1;
    setClickCount(next);

    if (next >= 5) {
      router.push('/');
    }

    timeoutRef.current = setTimeout(() => setClickCount(0), 3000);
  };

  return (
    <main className="h-screen flex flex-col justify-center items-center relative bg-yellow-50">
      <h1 className="text-2xl mb-2">ようこそ NovaTrail へ</h1>
      <p className="mb-4">こちらはサッカー試合情報の可視化アプリです。</p>
      <button
        className="absolute top-4 left-4 w-16 h-16 bg-pink-500 opacity-70 hover:opacity-100 rounded-md z-10"
        onClick={handleClick}
      >
        Tap
      </button>
    </main>
  );
}
