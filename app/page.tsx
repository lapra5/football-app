'use client';

import { useState, useRef } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    setCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        window.location.href = "/welcome.html"; // 静的HTMLに飛ばす
      }
      return next;
    });

    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCount(0), 5000);
  };

  return (
    <div
      className="w-full h-screen"
      onClick={handleClick}
      style={{ background: "#fff", cursor: "pointer" }}
    >
      {/* 一時的に枠をつけてわかりやすく */}
      <div
        className="border border-dashed border-blue-400 rounded p-6"
        style={{ width: "200px", margin: "auto", marginTop: "40vh", opacity: 0.05 }}
      >
        <p style={{ fontSize: "0.75rem" }}>5回クリックで初期画面へ</p>
      </div>
    </div>
  );
}
