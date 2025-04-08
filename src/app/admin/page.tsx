"use client";

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

interface LeagueName {
  en: string;
  jp: string;
}

interface TeamLeagueNames {
  teams: TeamInfo[];
  leagues: LeagueName[];
}

export default function AdminDashboard() {
  const { user, logout, isInitialized } = useAuth();
  const [isAdmin, setIsAdmin] = useState<true | false | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamLeagueNames, setTeamLeagueNames] = useState<TeamLeagueNames | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingLogos, setLoadingLogos] = useState(false);
  const [adminApiLoading, setAdminApiLoading] = useState(false);
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

  const handleAdminAction = async (url: string, successMessage: string, key: string) => {
    setAdminApiLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${await user?.getIdToken()}` },
      });
      await res.json();
      alert(successMessage);
      fetchAllData();
    } catch {
      alert("エラーが発生しました");
    } finally {
      setAdminApiLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
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
          {
            key: "updateMatches",
            label: "全リーグ日程更新",
            url: "/api/admin/update-matches?all=true",
            color: "blue",
            title: "全リーグの日程をAPIから取得してFirestoreに保存します。",
          },
          {
            key: "updateCL",
            label: "CL日程更新",
            url: "/api/admin/update-matches?leagueId=2001",
            color: "purple",
            title: "CL（チャンピオンズリーグ）の日程を取得してFirestoreに保存します。",
          },
          {
            key: "updateLineups",
            label: "スタメン一括更新",
            url: "/api/admin/update-lineups",
            color: "green",
            title: "日本人が所属する試合のスタメンをAPIから取得してFirestoreに反映します。",
          },
          {
            key: "updatePlayers",
            label: "移籍情報更新",
            url: "/api/admin/update-players",
            color: "indigo",
            title: "日本人選手の最新の移籍情報をYahoo! JAPANから取得して更新します。",
          },
          {
            key: "updateSeason",
            label: "シーズン更新",
            url: "/api/admin/update-season-data",
            color: "yellow",
            title: "チーム名やロゴ、リーグ情報などをすべて再取得してデータを更新します。",
          },
          {
            key: "updateScraped_jleague",
            label: "Jリーグ日程更新",
            url: "/api/admin/update-jleague-schedule",
            color: "orange",
            title: "Jリーグ（J1〜J3）の公式サイトから日程を取得し、Firestoreに保存します。",
          },
          {
            key: "updateScraped_celtic",
            label: "セルティック日程更新",
            url: "/api/admin/update-scotland-schedule",
            color: "cyan",
            title: "セルティックFCの試合日程をTransfermarktから取得し、Firestoreに保存します。",
          },
        ].map(({ key, label, url, color, title }) => (
          <div key={key} className="text-center space-y-1">
            <p className="text-xs text-gray-500">最終更新: {formatDateTime(lastUpdated[key])}</p>
            <button
              title={title}
              onClick={() => handleAdminAction(url, `${label}完了！`, key)}
              disabled={adminApiLoading}
              className={`bg-${color}-600 hover:bg-${color}-700 text-white px-4 py-2 rounded shadow`}
            >
              {adminApiLoading ? "処理中..." : label}
            </button>
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
          onFetchLineups={() =>
            handleAdminAction("/api/admin/update-lineups", "スタメン一括更新完了！", "updateLineups")
          }
          lineupUpdateResults={[]}
          teamLeagueNames={teamLeagueNames}
        />
      )}
    </main>
  );
}
