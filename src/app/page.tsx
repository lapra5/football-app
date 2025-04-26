"use client";

import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { SignupForm } from "@/components/SignupForm";
import MatchList from "@/components/MatchList";
import { Match } from "@/types/match";
import teamLeagueNames from "@/data/team_league_names.json"; // ✅ JSON直接OK

export default function HomePage() {
  const { user, logout, isInitialized } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

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

    if (user) {
      loadMatches();
    }
  }, [user]);

  if (!isInitialized) return <main className="text-center p-8">認証状態を確認中...</main>;
  if (user && loadingMatches) return <main className="text-center p-8">試合データを読み込み中...</main>;

  return (
    <main className="container mx-auto px-4 py-8">
      {!user ? (
        <>
          <h1 className="text-3xl font-bold mb-4 text-center">ログインまたは新規登録</h1>
          <div className="flex flex-col md:flex-row gap-8 justify-center">
            <LoginForm />
            <SignupForm />
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
                onFetchLineups={() => Promise.resolve()} // ✅ 今は使わないので空で
                lineupUpdateResults={[]} // ✅ 今は使わないので空で
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
