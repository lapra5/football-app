// "use client";
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
  updateScraped_scotland: "セルティックFCの試合日程をTransfermarktから取得し、Firestoreに保存します。",
};

const colorMap: Record<string, string> = {
  blue: "bg-blue-600 hover:bg-blue-700",
  purple: "bg-purple-600 hover:bg-purple-700",
  green: "bg-green-600 hover:bg-green-700",
  indigo: "bg-indigo-600 hover:bg-indigo-700",
  yellow: "bg-yellow-600 hover:bg-yellow-700",
  orange: "bg-orange-600 hover:bg-orange-700",
  cyan: "bg-cyan-600 hover:bg-cyan-700",
};

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
      const res = await fetch("/api/matches");
      const data = await res.json();
      setMatches(data.matches || []);
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
      console.log("✅ teamLeagueNames fetched:", data);
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

  const renderTimestamp = (key: string) => {
    return lastUpdated[key]
      ? new Date(lastUpdated[key]).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      : "未取得";
  };

  const getJapanesePlayers = () => {
    if (!teamLeagueNames) return [];
    const filtered = teamLeagueNames.teams
      .filter((team) => team.players && team.players.length > 0)
      .map((team) => ({
        teamId: team.teamId,
        teamName: team.team,
        players: team.players,
      }));

    console.log("👀 日本人選手抽出結果:", filtered);
    return filtered;
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
          { key: "updateMatches", label: "全リーグ日程更新", url: "/api/admin/update-matches?all=true", color: "blue" },
          { key: "updateCL", label: "CL日程更新", url: "/api/admin/update-matches?leagueId=2001", color: "purple" },
          { key: "updateLineups", label: "スタメン一括更新", url: "/api/admin/update-lineups", color: "green" },
          { key: "updatePlayers", label: "移籍情報更新", url: "/api/admin/update-players", color: "indigo" },
          { key: "updateSeason", label: "シーズン更新", url: "/api/admin/update-season-data", color: "yellow" },
          { key: "updateScraped_jleague", label: "Jリーグ日程更新", url: "/api/admin/update-scraped-matches", color: "orange" },
          { key: "updateScraped_scotland", label: "スコットランド日程更新", url: "/api/admin/update-scraped-matches", color: "cyan" },
        ].map(({ key, label, url, color }) => (
          <div key={key} className="text-center space-y-1">
            <p className="text-xs text-gray-500">最終更新: {renderTimestamp(key)}</p>
            <button
              onClick={() => handleAdminAction(url, `${label}完了！`, key)}
              disabled={adminApiLoading}
              title={buttonDescriptions[key]}
              className={`${colorMap[color]} text-white px-4 py-2 rounded shadow`}
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

      {teamLeagueNames && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4 text-center">日本人選手が所属するチーム一覧</h2>
          <ul className="space-y-2">
            {getJapanesePlayers().map(({ teamId, teamName, players }) => (
              <li key={teamId} className="bg-gray-100 p-4 rounded shadow">
                <strong>{teamName}</strong>：{players.join("、")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
