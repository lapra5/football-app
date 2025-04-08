"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/LoginForm";
import { SignupForm } from "@/components/SignupForm";
import MatchList from "@/components/MatchList";
import { Match } from "@/types/match";
import teamLeagueNames from "@/data/team_league_names.json"; // ✅ これはJSON直接OK

interface TeamInfo {
  teamId: number;
  team: string;
  englishName: string;
  players: string[];
  logo: string;
}
interface TeamLeagueNames {
  teams: TeamInfo[];
  leagues: Record<string, string>;
}

export default function HomePage() {
  const { user, logout, isInitialized } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [lineupUpdateResults, setLineupUpdateResults] = useState<{ matchId: string; message: string }[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const loadMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch("/api/current-month-matches"); // ✅ API 経由に変更
      const data = await res.json();
      setMatches(data || []);
    } catch (err) {
      console.error("試合データ取得エラー:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadMatches(); // ✅ ログイン後に試合データ取得
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
              <div className="flex gap-4 justify-center">
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
                lineupUpdateResults={lineupUpdateResults}
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
