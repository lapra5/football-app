'use client';

import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { refreshUserClaims } from "@/hooks/useRefreshClaims";
import { useRouter } from "next/navigation";
import { Match } from "@/types/match";
import MatchList from "@/components/MatchList";

interface TeamInfo {
  teamId: number;
  team: string;
  englishName: string;
  players: string[];
  englishplayers: string[];
  logo: string;
}

interface League {
  en: string;
  jp: string;
}

interface TeamLeagueNames {
  teams: TeamInfo[];
  leagues: League[];
}

const buttonDescriptions: Record<string, string> = {
  updateMatches: "全リーグの日程をAPIから取得してFirestoreに保存します。",
  updateCL: "CL（チャンピオンズリーグ）の日程を取得してFirestoreに保存します。",
  updateLineups: "日本人が所属する試合のスタメンをAPIから取得してFirestoreに反映します。",
  updatePlayers: "日本人選手の移籍情報を取得し、所属チーム情報を更新します。",
  updateSeason: "チーム名やロゴ、リーグ情報などをすべて再取得してデータを更新します。",
  updateScraped_jleague: "Jリーグ（J1〜J3）の公式サイトから日程を取得し、Firestoreに保存します。",
  updateScraped_scotland: "スコットランドリーグの試合日程を取得してFirestoreに保存します。",
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "未取得";
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "未取得";
  }
};

export default function AdminDashboard() {
  const { user, logout, isInitialized } = useAuth();
  const [isAdmin, setIsAdmin] = useState<true | false | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamLeagueNames, setTeamLeagueNames] = useState<TeamLeagueNames | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingLogos, setLoadingLogos] = useState(false);
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
      if (token.claims.admin === true) {
        fetchAllData();
      }
    };

    if (isInitialized) {
      checkAdmin();
    }
  }, [user, isInitialized, router]);

  const fetchAllData = async () => {
    await Promise.all([fetchMatches(), fetchLogos(), fetchLastUpdated()]);
  };

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await fetch("/api/current-month-matches");
      const data = await res.json();
      setMatches(data || []);
    } catch (err) {
      console.error("❌ fetchMatches エラー:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const fetchLogos = async () => {
    setLoadingLogos(true);
    try {
      const res = await fetch("/api/team-league-names");
      const data = await res.json();
      setTeamLeagueNames(data);
    } catch (err) {
      console.error("❌ fetchLogos エラー:", err);
    } finally {
      setLoadingLogos(false);
    }
  };

  const fetchLastUpdated = async () => {
    try {
      const res = await fetch("/api/admin/last-updated");
      const data = await res.json();
      setLastUpdated(data);
    } catch (err) {
      console.error("❌ fetchLastUpdated エラー:", err);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (!isInitialized || isAdmin === null) {
    return <div className="p-8 text-center">管理者権限を確認中...</div>;
  }

  if (isAdmin === false) {
    return <div className="p-8 text-center">権限がありません。</div>;
  }

  if (loadingMatches || loadingLogos) {
    return <div className="p-8 text-center">データを読み込み中...</div>;
  }

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">管理者ダッシュボード</h1>

      <div className="flex flex-wrap justify-center gap-4">
  {[
    { key: "updateMatches", label: "全リーグ日程更新", color: "blue" },
    { key: "updateCL", label: "CL日程更新", color: "purple" },
    { key: "updateLineups", label: "スタメン一括更新", color: "green" },
    { key: "updatePlayers", label: "移籍情報更新", color: "indigo" },
    { key: "updateSeason", label: "シーズン更新", color: "yellow" },
    { key: "updateScraped_jleague", label: "Jリーグ日程更新", color: "orange" },
    { key: "updateScraped_scotland", label: "スコットランド日程更新", color: "cyan" },
  ].map(({ key, label, color }) => (
    <div key={key} className="text-center space-y-1 relative group">
      <p className="text-xs text-gray-500">最終更新: {formatDateTime(lastUpdated[key])}</p>
      <div
        className={`bg-${color}-600 text-white px-4 py-2 rounded shadow flex items-center justify-center`}
      >
        {label}
        <span className="ml-1 text-white cursor-pointer relative group-hover:underline">❗
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-1 rounded bg-black text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition duration-200 z-10">
            {buttonDescriptions[key]}
          </div>
        </span>
      </div>
    </div>
  ))}

  <button
    onClick={handleLogout}
    className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
  >
    ログアウト
  </button>
</div>



      {teamLeagueNames && (
        <MatchList
          matches={matches}
          onFetchLineups={async () => {}}
          lineupUpdateResults={[]}
          teamLeagueNames={teamLeagueNames}
        />
      )}
    </main>
  );
}
