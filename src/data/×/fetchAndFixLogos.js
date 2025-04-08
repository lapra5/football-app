import fs from "fs";
import path from "path";
import https from "https";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve("../../.env.local") });

const apiKey = process.env.API_FOOTBALL_KEY;
if (!apiKey) {
  console.error("❌ .env.local に API_FOOTBALL_KEY が設定されていません");
  process.exit(1);
}

const leagues = {
  "Premier League": "プレミアリーグ（イングランド1部）",
  "Championship": "EFLチャンピオンシップ（イングランド2部）",
  "EFL Championship": "EFLチャンピオンシップ（イングランド2部）",
  "League One": "EFLリーグ1（イングランド3部）",
  "Bundesliga": "ブンデスリーガ（ドイツ1部）",
  "1. Bundesliga": "ブンデスリーガ（ドイツ1部）",
  "Serie A": "セリエA（イタリア1部）",
  "La Liga": "ラ・リーガ（スペイン1部）",
  "Primera Division": "ラ・リーガ（スペイン1部）",
  "Ligue 1": "リーグ・アン（フランス1部）",
  "Eredivisie": "エールディヴィジ（オランダ1部）",
  "Primeira Liga": "プリメイラ・リーガ（ポルトガル1部）",
  "Champions-League": "UEFAチャンピオンズリーグ",
  "Campeonato Brasileiro Série A": "カンピオナート・ブラジレイロ・セリエA（ブラジル1部）",
};

const breakAfterIds = [1044, 576, 6806, 7397, 745, 721, 10340, 1138];
const filePath = path.resolve("team_league_names.json");
const raw = fs.readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

const checkUrlExists = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => resolve(res.statusCode === 200)).on("error", () => resolve(false));
  });
};

const fetchLogoByTeamIdFromAPIFootball = async (teamId, teamName) => {
  const url = `https://v3.football.api-sports.io/teams?id=${teamId}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
    });
    const json = await res.json();
    if (json.response && json.response.length > 0) {
      console.log(`✅ ${teamName} (ID: ${teamId}) → API-FOOTBALL からロゴ取得成功`);
      return json.response[0].team.logo;
    }
  } catch (err) {
    console.error(`❌ ${teamName} (ID: ${teamId}) API-FOOTBALL 通信エラー:`, err);
  }
  return "";
};

const fetchLogoFromTheSportsDB = async (teamName) => {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.teams && json.teams.length > 0) {
      console.log(`✅ ${teamName} → TheSportsDB からロゴ取得成功`);
      return json.teams[0].strTeamBadge ?? "";
    }
  } catch (err) {
    console.error(`❌ ${teamName} TheSportsDB 通信エラー:`, err);
  }
  return "";
};

const run = async () => {
  console.log("🔎 Step1: football-data.org ロゴURL診断 & 自動修正を開始...");
  for (const team of data.teams) {
    const logoUrl = `https://crests.football-data.org/${team.teamId}.svg`;
    const exists = await checkUrlExists(logoUrl);
    if (!exists) {
      console.log(`⚠️ ${team.team} (${team.teamId}) のロゴが見つからず → 空に設定`);
      team.logo = "";
    } else {
      team.logo = logoUrl;
    }
  }

  console.log("🚀 Step2: API-FOOTBALL でロゴ補完開始...");
  for (const team of data.teams) {
    if (!team.logo) {
      console.log(`➡️ ${team.team} (ID: ${team.teamId}) API-FOOTBALL 取得中...`);
      const apiFootballLogo = await fetchLogoByTeamIdFromAPIFootball(team.teamId, team.team);
      if (apiFootballLogo) {
        team.logo = apiFootballLogo;
      }
    }
  }

  console.log("🔎 Step3: TheSportsDB で残りを検索開始...");
  for (const team of data.teams) {
    if (!team.logo) {
      console.log(`➡️ ${team.team} (ID: ${team.teamId}) TheSportsDB 取得中...`);
      const sportsDbLogo = await fetchLogoFromTheSportsDB(team.team);
      if (sportsDbLogo) {
        team.logo = sportsDbLogo;
      } else {
        console.log(`⚠️ ${team.team} (ID: ${team.teamId}) どのAPIでもロゴ取得失敗`);
      }
    }
  }

  console.log("💾 最終結果を team_league_names.json に保存中...");
  const teamLines = data.teams.flatMap((team, index, arr) => {
    const line = `  { "teamId": ${team.teamId}, "team": "${team.team}", "players": ${JSON.stringify(
      team.players
    )}, "logo": "${team.logo}" }${index < arr.length - 1 ? "," : ""}`;
    return breakAfterIds.includes(team.teamId) ? [line, ""] : [line];
  });

  const leaguesJson = JSON.stringify({ leagues }, null, 2).replace(/^{\n|}$/g, "");
  const finalJson = `{\n  "teams": [\n${teamLines.join("\n")}\n  ],\n${leaguesJson}\n}`;

  fs.writeFileSync(filePath, finalJson, "utf-8");
  console.log(`🎉 すべて完了！team_league_names.json を更新しました！`);
};

run();
