'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function HiddenTriggerPage() {
  const router = useRouter();
  const [clicks, setClicks] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    setClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        router.push('/login-view');
      }
      return next;
    });

    // 5秒以内にリセット
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setClicks(0), 5000);
  };

  return (
    <main
      className="w-screen h-screen bg-gray-900 flex items-center justify-center text-white"
      onClick={handleClick}
    >
      <div
        className="w-12 h-12 rounded-full bg-transparent border border-white hover:bg-white/10 transition"
        title="5回クリックでログインへ"
      />
    </main>
  );
}
