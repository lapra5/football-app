"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { refreshUserClaims } from "@/hooks/useRefreshClaims";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const { user, isInitialized } = useAuth();
  const [isAdmin, setIsAdmin] = useState<true | false | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        router.push("/");
        return;
      }
      await refreshUserClaims();
      const token = await user.getIdTokenResult();
      setIsAdmin(token.claims.admin === true);
    };

    if (isInitialized) checkAdmin();
  }, [user, isInitialized, router]);

  if (!isInitialized || isAdmin === null) {
    return <div className="p-8 text-center">管理者権限を確認中...</div>;
  }

  if (isAdmin === false) {
    return <div className="p-8 text-center">権限がありません。</div>;
  }

  return <AdminDashboard />;
}
