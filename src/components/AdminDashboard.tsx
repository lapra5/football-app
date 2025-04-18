'use client';

import { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { refreshUserClaims } from "@/hooks/useRefreshClaims";
import { useRouter } from "next/navigation";
import { Match } from "@/types/match";
import MatchList from "@/components/MatchList";

interface TeamInfo {
  teamId: number;
  team: string;
  englishName: string;
  players: string[];
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

const buttonInfo = [
  {
    key: "updateTeamsMeta",
    label: "チーム情報更新",
    description: "欧州主要リーグのチーム名・日本語名・ロゴ・日本人選手情報をAPIやWikidataから取得し、team_league_names.json を更新します。",
    frequency: "毎年8月1日 12:00（年1回）",
    className: "bg-yellow-600 hover:bg-yellow-700"
  },
  {
    key: "updateCurrentMonthMatch",
    label: "海外試合更新",
    description: "欧州主要リーグの試合情報をFirebaseから取得し、current_month_matches_oversea.json に保存します。対象期間は前後30日間です。",
    frequency: "毎日 13:00 に自動実行",
    className: "bg-blue-600 hover:bg-blue-700"
  },
  {
    key: "fetchLineups",
    label: "スタメン抽出",
    description: "試合30〜90分前のタイミングでFootballDataAPIからスタメンを取得して current_month_matches.json を更新します。",
    frequency: "毎時 0,15,30,45分 に自動実行",
    className: "bg-green-600 hover:bg-green-700"
  },
  {
    key: "fetchScores",
    label: "スコア更新",
    description: "キックオフから2時間以上経過し、スコア未登録の試合をAPIから取得してスコア情報を反映します。",
    frequency: "毎時 0分・30分に自動実行",
    className: "bg-indigo-600 hover:bg-indigo-700"
  },
  {
    key: "updateMatchdayStatus",
    label: "マッチデイ更新",
    description: "各リーグの現在・前節・次節のマッチデイ番号をFirestoreのリーグドキュメントに更新します。",
    frequency: "毎日 14:00 に自動実行",
    className: "bg-purple-600 hover:bg-purple-700"
  },
  {
    key: "updateJleagueSchedule",
    label: "Jリーグ日程更新",
    description: "Jリーグ（J1〜J3）の試合日程をJリーグ公式サイトから取得し、Firestoreに保存します。",
    frequency: "毎日 7:00 に自動実行",
    className: "bg-orange-600 hover:bg-orange-700"
  },
  {
    key: "updateCelticSchedule",
    label: "セルティック日程更新",
    description: "スコットランドリーグ（セルティックFC）の試合日程をTransfermarktから取得してFirestoreに保存します。",
    frequency: "毎日 7:00 に自動実行",
    className: "bg-cyan-600 hover:bg-cyan-700"
  },
  {
    key: "updatePlayers",
    label: "移籍情報更新",
    description: "Yahoo! JAPAN掲載の日本人選手リストから、移籍先チーム情報と英語名を取得・照合し、team_league_names.json を更新します。",
    frequency: "1月・6月〜9月の毎日 朝12:00に自動実行",
    className: "bg-pink-600 hover:bg-pink-700"
  },
  {
    key: "mergeMatches",
    label: "マッチデータ統合",
    description: "Jリーグ・セルティック・海外リーグのマッチデータを結合して current_month_matches.json を生成します。",
    frequency: "毎日 朝7:00に自動実行",
    className: "bg-gray-700 hover:bg-gray-800"
  }
];

const formatDateTime = (iso?: string) => {
  if (!iso) return "未取得";
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
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
    if (isInitialized) checkAdmin();
  }, [user, isInitialized, router]);

  const fetchAllData = async () => {
    await Promise.all([fetchMatches(), fetchLogos(), fetchLastUpdated()]);
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch("/api/current-month-matches");
      const data = await res.json();
      setMatches(data || []);
    } catch (err) {
      console.error("❌ fetchMatches エラー:", err);
    }
  };

  const fetchLogos = async () => {
    try {
      const res = await fetch("/api/team-league-names");
      const data = await res.json();
      setTeamLeagueNames(data);
    } catch (err) {
      console.error("❌ fetchLogos エラー:", err);
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

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">管理者ダッシュボード</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {buttonInfo.map(({ key, label, description, frequency, className }) => (
          <div key={key} className="text-center text-sm space-y-1 group relative">
            <div className="text-gray-500">
              🕒 最終更新: {formatDateTime(lastUpdated[key])}<br />
              📅 更新頻度: {frequency}
            </div>
            <div
              className={`${className} px-3 py-2 rounded text-white cursor-default`}
              title={description}
            >
              {label}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded shadow col-span-full"
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
