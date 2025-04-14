import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import { updateTimestamp } from "../src/utils/updateLog.ts";

dotenv.config({ path: path.resolve("../../.env.local") });

const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const DISCORD_WEBHOOK_TEAMS = process.env.DISCORD_WEBHOOK_TEAMS;

if (!FOOTBALL_DATA_KEY || !API_FOOTBALL_KEY) {
  console.error("❌ 環境変数が設定されていません");
  process.exit(1);
}

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
};

const breakAfterIds = [1044, 576, 6806, 7397, 745, 721, 10340, 1138];
const outputFile = path.resolve("team_league_names.json");

const fetchTeamsFromFootballData = async (leagueId: number) => {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${leagueId}/teams`,
    { headers: { "X-Auth-Token": FOOTBALL_DATA_KEY! } }
  );
  const data = await res.json();
  return data.teams || [];
};

const fetchJapanesePlayers = async (teamId: number) => {
  const res = await fetch(
    `https://v3.football.api-sports.io/players?team=${teamId}&season=2023&nationality=Japan`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY! } }
  );
  const json = await res.json();
  return json.response.map((player: any) => player.player.name);
};

const fetchLogoFromAPIFootball = async (englishName: string) => {
  const res = await fetch(
    `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(englishName)}`,
    { headers: { "x-apisports-key": API_FOOTBALL_KEY! } }
  );
  const json = await res.json();
  return json.response[0]?.team.logo || "";
};

const fetchLogoFromTheSportsDB = async (englishName: string) => {
  const res = await fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(englishName)}`
  );
  const json = await res.json();
  return json.teams?.[0]?.strTeamBadge || "";
};

const fetchJapaneseNameFromWikidata = async (englishName: string) => {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(englishName)}&language=en&format=json&type=item`
    );
    const data = await res.json();
    const entityId = data.search[0]?.id;
    if (!entityId) return "";

    const entityRes = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&languages=ja&props=labels`
    );
    const entityData = await entityRes.json();
    return entityData.entities?.[entityId]?.labels?.ja?.value || "";
  } catch (err) {
    console.error(`❌ Wikidata取得エラー (${englishName}):`, err);
    return "";
  }
};

const run = async () => {
  console.log("📥 Step1: チームデータ取得中...");
  const allTeams: {
    teamId: number;
    englishName: string;
    team: string;
    players: string[];
    logo: string;
  }[] = [];

  for (const leagueId of [2021, 2016, 2015, 2002, 2019, 2014, 2003, 2017, 2013]) {
    const leagueTeams = await fetchTeamsFromFootballData(leagueId);
    leagueTeams.forEach((team: any) => {
      allTeams.push({
        teamId: team.id,
        englishName: team.name,
        team: "",
        players: [],
        logo: "",
      });
    });
  }

  console.log("🌍 Step2: Wikidataから日本語名取得中...");
  let index = 0;
  const concurrencyLimit = 5;

  const translateBatch = async (batch: typeof allTeams) =>
    Promise.all(
      batch.map(async (team) => {
        index++;
        console.log(`🔎 (${index}/${allTeams.length}) ${team.englishName} 翻訳中...`);
        team.team = await fetchJapaneseNameFromWikidata(team.englishName);
      })
    );

  for (let i = 0; i < allTeams.length; i += concurrencyLimit) {
    await translateBatch(allTeams.slice(i, i + concurrencyLimit));
  }

  console.log("🏷 Step3: ロゴ検索中...");
  for (const team of allTeams) {
    const logoUrl = `https://crests.football-data.org/${team.teamId}.svg`;
    const headRes = await fetch(logoUrl, { method: "HEAD" });
    if (headRes.ok) {
      team.logo = logoUrl;
      continue;
    }

    const apiFootballLogo = await fetchLogoFromAPIFootball(team.englishName);
    if (apiFootballLogo) {
      team.logo = apiFootballLogo;
      continue;
    }

    const sportsDBLogo = await fetchLogoFromTheSportsDB(team.englishName);
    team.logo = sportsDBLogo || "";
  }

  console.log("🇯🇵 Step4: 日本人選手の情報取得中...");
  for (const team of allTeams) {
    team.players = await fetchJapanesePlayers(team.teamId);
  }

  console.log("💾 Step5: JSONファイルに保存中...");
  const teamLines = allTeams.flatMap((team, index, arr) => {
    const line = `  { "teamId": ${team.teamId}, "team": "${team.team}", "englishName": "${team.englishName}", "players": ${JSON.stringify(team.players)}, "logo": "${team.logo}" }${index < arr.length - 1 ? "," : ""}`;
    return breakAfterIds.includes(team.teamId) ? [line, ""] : [line];
  });

  const leaguesJson = JSON.stringify({ leagues }, null, 2).replace(/^{\n|}$/g, "");
  const finalJson = `{
  "teams": [
${teamLines.join("\n")}
  ],
${leaguesJson}
}`;

    // 🔁 強制上書き（中身が同じでも必ず更新される）
    fs.writeFileSync(outputFile, finalJson, "utf-8");
    console.log("✅ team_league_names.json を強制的に上書きしました");

    // 🕒 更新後の更新日時を出力（デバッグ確認用）
    const { mtime } = fs.statSync(outputFile);
    console.log(`🕒 ファイルの更新日時: ${mtime.toISOString()}`);

    // ✅ updated_log.json に更新記録
    updateTimestamp("updateTeamsMeta");


  // ✅ Discord 通知
  if (DISCORD_WEBHOOK_TEAMS) {
    await sendDiscordMessage(
      `✅ チーム情報を更新しました（件数: ${allTeams.length}）`,
      DISCORD_WEBHOOK_TEAMS
    );
  }
};

run();
