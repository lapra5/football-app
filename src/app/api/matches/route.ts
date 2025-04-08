import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import fs from "fs";
import path from "path";

const teamLeagueNamesPath = path.resolve("F:/Python/practice/web_sample/my-app/src/data/team_league_names.json");
const teamLeagueNames = JSON.parse(fs.readFileSync(teamLeagueNamesPath, "utf-8"));

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

const leagueIds = [
  2013, // ブラジル
  2016, // チャンピオンシップ
  2021, // プレミアリーグ
  2015, // リーグ・アン
  2002, // ブンデスリーガ
  2019, // セリエA
  2003, // エールディヴィジ
  2017, // プリメイラ・リーガ
  2014, // ラ・リーガ
  2001, // UEFAチャンピオンズリーグ
  "jleague", // ✅ Jリーグ追加
  "celtic",  // ✅ セルティック追加
];

export async function GET() {
  try {
    const allMatches: any[] = [];
    const now = new Date();

    for (const leagueId of leagueIds) {
      const snapshot = await getDocs(collection(db, `leagues/${leagueId}/matches`));
      const leagueMatches = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const homeId = Number(data.homeTeam?.id ?? 0);
          const awayId = Number(data.awayTeam?.id ?? 0);

          const homeInfo = teamLeagueNames.teams.find((t) => t.teamId === homeId);
          const awayInfo = teamLeagueNames.teams.find((t) => t.teamId === awayId);

          const leagueLabel =
            teamLeagueNames.leagues[leagueNameMap[data.league] ?? data.league] ?? data.league;

          const matchday = Number(data.matchday ?? -1);
          const kickoffTime = data.kickoffTime ?? "";

          const kickoff = new Date(kickoffTime);
          if (isNaN(kickoff.getTime())) return null;

          return {
            matchId: data.matchId ?? data.id?.toString(),
            league: leagueLabel,
            kickoffTime,
            matchday,
            homeTeam: {
              id: homeId,
              name: homeInfo?.team ?? data.homeTeam?.name,
              players: homeInfo?.players ?? [],  // ✅ 日本人選手をここに明示
            },
            awayTeam: {
              id: awayId,
              name: awayInfo?.team ?? data.awayTeam?.name,
              players: awayInfo?.players ?? [],  // ✅ 同上
            },
            lineupStatus: data.lineupStatus ?? "未発表",
            score: data.score ?? { fullTime: { home: null, away: null } },
            startingMembers: data.startingMembers ?? [],
            substitutes: data.substitutes ?? [],
            outOfSquad: data.outOfSquad ?? [],
          };
        })
        .filter((m): m is NonNullable<typeof m> => !!m);

      const futureMatches = leagueMatches
        .filter((m) => {
          const kickoff = new Date(m.kickoffTime);
          return (
            kickoff > now || (kickoff <= now && now <= new Date(kickoff.getTime() + 2 * 60 * 60 * 1000))
          );
        })
        .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

      if (futureMatches.length > 0) {
        const nearestMatchday = futureMatches[0].matchday;
        allMatches.push(
          ...futureMatches.filter((m) => m.matchday === nearestMatchday)
        );
      }
    }

    return NextResponse.json({ matches: allMatches });
  } catch (error) {
    console.error("🔥 matches APIエラー: ", error);
    return NextResponse.json({ error: "試合データ取得中にエラーが発生しました" }, { status: 500 });
  }
}
