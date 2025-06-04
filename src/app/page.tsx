'use client';

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshUserClaims } from "@/hooks/useRefreshClaims";
import { LoginForm } from "@/components/LoginForm";
import { SignupForm } from "@/components/SignupForm";
import Link from "next/link";
import MatchList from "@/components/MatchList";
import { Match } from "@/types/match";
import rawTeamLeagueNames from "@/data/team_league_names.json" assert { type: "json" };

const teamLeagueNames = {
  ...rawTeamLeagueNames,
  leagues: Object.values(rawTeamLeagueNames.leagues),
};

export default function HomePage() {
  const { user, logout, isInitialized } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadMatches = async () => {
      setLoadingMatches(true);
      try {
        const res = await fetch("/current_month_matches.json");
        const data = await res.json();
        setMatches(data || []);
      } catch (err) {
        console.error("試合データ取得エラー:", err);
      } finally {
        setLoadingMatches(false);
      }
    };
    if (user) loadMatches();
  }, [user]);

  useEffect(() => {
    const redirectIfAdmin = async () => {
      if (user) {
        await refreshUserClaims();
        const token = await user.getIdTokenResult();
        if (token.claims.admin === true) {
          router.push("/admin");
        }
      }
    };
    if (isInitialized) redirectIfAdmin();
  }, [user, isInitialized, router]);

  if (!isInitialized) return <main className="text-center p-8">認証状態を確認中...</main>;
  if (user && loadingMatches) return <main className="text-center p-8">試合データを読み込み中...</main>;

  return (
    <main className="container mx-auto px-4 py-8">
      {!user ? (
        <>
          <h1 className="text-3xl font-bold mb-8 text-center">ログイン</h1>

          <div className="flex flex-col md:flex-row gap-2 justify-center items-start">
            <div className="w-[300px]">
              <LoginForm />
            </div>
            <div className="w-[300px]">
              <SignupForm />
            </div>
          </div>

          <div className="text-center mt-4">
            <Link href="/password-reset" className="text-blue-600 hover:underline text-sm">
              パスワードを忘れた方はこちら
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {matches.length > 0 ? (
            <>
              <div className="flex justify-center">
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow"
                >
                  ログアウト
                </button>
              </div>
              <MatchList
                matches={matches}
                teamLeagueNames={teamLeagueNames}
                onFetchLineups={() => Promise.resolve()}
                lineupUpdateResults={[]}
              />
            </>
          ) : (
            <p className="text-center text-lg">試合データがありません</p>
          )}
        </div>
      )}
    </main>
  );
}
