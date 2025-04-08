import { NextResponse } from "next/server";
import admin from "@/firebaseAdmin";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { updateTimestamp } from "@/utils/updateLog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY!;
const outputFile = path.resolve("F:/Python/practice/web_sample/my-app/src/data/team_league_names.json");

const leagues = {
  "Premier League": "プレミアリーグ（イングランド1部）",
  "Championship": "EFLチャンピオンシップ（イングランド2部）",
  "League One": "EFLリーグ1（イングランド3部）",
  "Bundesliga": "ブンデスリーガ（ドイツ1部）",
  "Serie A": "セリエA（イタリア1部）",
  "La Liga": "ラ・リーガ（スペイン1部）",
  "Ligue 1": "リーグ・アン（フランス1部）",
  "Eredivisie": "エールディヴィジ（オランダ1部）",
  "Primeira Liga": "プリメイラ・リーガ（ポルトガル1部）",
  "Champions-League": "UEFAチャンピオンズリーグ",
  "Campeonato Brasileiro Série A": "カンピオナート・ブラジレイロ・セリエA（ブラジル1部）",
};

const breakAfterIds = [1044, 576, 6806, 7397, 745, 721, 10340, 1138];

async function fetchTeamsFromFootballData(leagueId: number) {
  const res = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/teams`, {
    headers: { "X-Auth-Token": FOOTBALL_DATA_KEY },
  });
  const json = await res.json();
  return json.teams ?? [];
}

async function getJapaneseLabelFromWikidata(englishName: string) {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    englishName
  )}&language=ja&format=json&type=item`;
  try {
    const res = await fetch(searchUrl);
    const searchJson = await res.json();
    const entityId = searchJson.search?.[0]?.id;
    if (!entityId) return "";

    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`;
    const entityRes = await fetch(entityUrl);
    const entityJson = await entityRes.json();
    return entityJson.entities?.[entityId]?.labels?.ja?.value ?? "";
  } catch {
    return "";
  }
}

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

    const existingData = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
    const allTeams: any[] = [];
    const leagueIds = [2021, 2016, 2015, 2002, 2019, 2014, 2003, 2017, 2013];

    for (const leagueId of leagueIds) {
      const leagueTeams = await fetchTeamsFromFootballData(leagueId);
      leagueTeams.forEach((team: any) => {
        const existingTeam = existingData.teams.find((t: any) => t.teamId === team.id);
        allTeams.push({
          teamId: team.id,
          englishName: team.name,
          team: existingTeam?.team || team.name,
          players: existingTeam?.players || [],
          logo: existingTeam?.logo || "",
        });
      });
    }

    for (const team of allTeams) {
      if (team.team === team.englishName) {
        const wikidataName = await getJapaneseLabelFromWikidata(team.englishName);
        if (wikidataName) {
          team.team = wikidataName;
        }
      }
    }

    const teamLines = allTeams.flatMap((team, index, arr) => {
      const line = `  { "teamId": ${team.teamId}, "team": "${team.team}", "englishName": "${team.englishName}", "players": ${JSON.stringify(
        team.players
      )}, "logo": "${team.logo}" }${index < arr.length - 1 ? "," : ""}`;
      return breakAfterIds.includes(team.teamId) ? [line, ""] : [line];
    });

    const leaguesJson = JSON.stringify({ leagues }, null, 2).replace(/^{\n|}$/g, "");
    const finalJson = `{
  "teams": [
${teamLines.join("\n")}
  ],
${leaguesJson}
}`;

    fs.writeFileSync(outputFile, finalJson, "utf-8");

    updateTimestamp("updateSeason");

    return NextResponse.json({ message: "シーズンデータ更新完了！" });
  } catch (err) {
    console.error("🔥 update-season-data 実行エラー:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
