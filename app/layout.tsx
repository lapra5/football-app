import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics /> {/* 👈 ここを忘れずに！ */}
      </body>
    </html>
  );
}
