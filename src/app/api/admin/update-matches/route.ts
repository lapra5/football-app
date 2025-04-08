import { NextResponse } from "next/server";
import admin from "@/firebaseAdmin";
import { db } from "@/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { updateTimestamp } from "@/utils/updateLog";

const LEAGUE_IDS = [
  2013, // ブラジル
  2016, // チャンピオンシップ
  2021, // プレミアリーグ
  2015, // リーグ・アン
  2002, // ブンデスリーガ
  2019, // セリエA
  2003, // エールディヴィジ
  2017, // プリメイラ・リーガ
  2014, // ラ・リーガ
];

const leagueNameMap: Record<string, string> = {
  "Primera Division": "La Liga",
  "Ligue 1": "Ligue 1",
  "Bundesliga": "Bundesliga",
  "Serie A": "Serie A",
  "Premier League": "Premier League",
  "Championship": "Championship",
  "Eredivisie": "Eredivisie",
  "Primeira Liga": "Primeira Liga",
  "Campeonato Brasileiro Série A": "Campeonato Brasileiro Série A",
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isAll = searchParams.get("all") === "true";
    const specificLeagueId = searchParams.get("leagueId");

    const targetLeagues = isAll
      ? LEAGUE_IDS
      : specificLeagueId
      ? [parseInt(specificLeagueId)]
      : [];

    const results: any[] = [];

    for (const leagueId of targetLeagues) {
      const apiRes = await fetch(
        `https://api.football-data.org/v4/competitions/${leagueId}/matches`,
        { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY! } }
      );

      if (!apiRes.ok) {
        throw new Error(`API fetch failed for league ${leagueId}`);
      }

      const json = await apiRes.json();
      const matches = json.matches || [];
      const leagueName = leagueNameMap[json.competition.name] || json.competition.name;

      for (const match of matches) {
        await setDoc(
          doc(db, `leagues/${leagueId}/matches`, match.id.toString()),
          {
            id: match.id,
            league: leagueName,
            matchday: match.matchday,
            kickoffTime: match.utcDate,
            homeTeam: {
              id: match.homeTeam.id,
              name: match.homeTeam.name,
            },
            awayTeam: {
              id: match.awayTeam.id,
              name: match.awayTeam.name,
            },
            lineupStatus: "未発表",
            score: match.score,
          },
          { merge: true }
        );
      }

      results.push({ leagueId, matchesSaved: matches.length });
    }

    if (isAll) {
      updateTimestamp("updateMatches");
    } else if (specificLeagueId === "2001") {
      updateTimestamp("updateCL");
    }

    return NextResponse.json({ message: "日程更新完了", results });
  } catch (err) {
    console.error("🔥 日程更新エラー:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
