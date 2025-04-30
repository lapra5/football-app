// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "NovaTrail",
  description: "Welcome to NovaTrail!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
