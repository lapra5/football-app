'use client';

import { PasswordResetForm } from "@/components/PasswordResetForm";

export default function PasswordResetPage() {
  const handleBack = () => {
    window.location.href = "/";
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6">パスワード変更フォーム</h1>

      <PasswordResetForm onBack={handleBack} />
    </main>
  );
}
