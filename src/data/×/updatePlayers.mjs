import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, "team_league_names.json");
const LOG_PATH = path.join(__dirname, "transfer_cleanup_log.csv");
const YAHOO_URL = "https://soccer.yahoo.co.jp/ws/japanese/players";

// ------------------- 共通処理 -------------------

function normalizeName(name) {
  return name
    .replace(/[・\s]/g, "")
    .replace(/ヴィ/g, "ビ")
    .replace(/トゥ/g, "ツ")
    .replace(/メンヘングラードバッハ/g, "メンヒェングラートバッハ")
    .replace(/[^぀-ヿ一-龯\w]/g, "")
    .toLowerCase();
}

function isMatch(nameA, nameB) {
  const normA = normalizeName(nameA);
  const normB = normalizeName(nameB);
  return normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA));
}

function loadTeamData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeCsvLog(logs) {
  const headers = "Type,Player,Team,Details\n";
  const rows = logs.map(l => `${l.type},${l.player},${l.team},${l.details || ""}`).join("\n");
  fs.writeFileSync(LOG_PATH, headers + rows, "utf8");
}

function saveTeamDataFormatted(data) {
  const breakIds = new Set([1044, 1138, 576, 721, 7397, 745, 6806, 10340]);
  const lines = [];

  lines.push("{");
  lines.push('  "teams": [');

  data.teams.forEach((team, idx) => {
    const players = team.players || [];
    const englishplayers = team.englishplayers || [];
    const line = `    { "teamId": ${team.teamId}, "team": "${team.team}", "englishName": "${team.englishName}", "players": [${players.map(p => `"${p}"`).join(", ")}], "englishplayers": [${englishplayers.map(p => `"${p}"`).join(", ")}], "logo": "${team.logo}" }`;
    const isLast = idx === data.teams.length - 1;
    lines.push(line + (breakIds.has(team.teamId) || !isLast ? "," : ""));
    if (breakIds.has(team.teamId)) lines.push("");
  });

  lines.push("  ],");
  lines.push('  "leagues": {');
  const leagueEntries = Object.entries(data.leagues || {});
  leagueEntries.forEach(([key, val], idx) => {
    lines.push(`    "${key}": "${val}"${idx < leagueEntries.length - 1 ? "," : ""}`);
  });
  lines.push("  }");
  lines.push("}");

  fs.writeFileSync(DATA_PATH, lines.join("\n"), "utf8");
}

// ------------------- 英語名取得ロジック -------------------

async function fetchFromWorldFootball(jpName) {
  const searchUrl = `https://www.worldfootball.net/search/?q=${encodeURIComponent(jpName)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const link = $('a[href*="/player_summary/"]').first().attr("href");
    if (!link) return "undefined";

    const detailRes = await fetch(`https://www.worldfootball.net${link}`);
    const detailHtml = await detailRes.text();
    const $$ = cheerio.load(detailHtml);
    const name = $$('.head h2[itemprop="name"]').text().trim();
    return name || "undefined";
  } catch {
    return "undefined";
  }
}

async function fetchEnglishName(jpName) {
  // Wikipedia
  const titles = [
    encodeURIComponent(jpName.replace(/ /g, "_")),
    encodeURIComponent(jpName.replace(/ /g, ""))
  ];
  for (const title of titles) {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks&titles=${title}&lllang=en`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const json = await res.json();
      const page = Object.values(json.query.pages)[0];
      if (page.langlinks && page.langlinks[0]) {
        return page.langlinks[0]["*"];
      }
    } catch {}
  }

  // FootballDatabase
  try {
    const searchUrl = `https://www.footballdatabase.eu/en/search/${encodeURIComponent(jpName)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const firstResult = $('a[href*="/players/"]').first().text().trim();
    if (firstResult) return firstResult;

    const nameH1 = $(".titlePlayer h1").first().text().trim().replace(/\s+/g, " ");
    if (nameH1) return nameH1;
  } catch {}

  // WorldFootball.net
  return await fetchFromWorldFootball(jpName);
}

// ------------------- Yahoo選手一覧取得 -------------------

async function fetchJapanesePlayers() {
  const res = await fetch("https://soccer.yahoo.co.jp/ws/japanese/players");
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $("section.sc-modCommon02").each((_, section) => {
    const team = $(section).find(".sc-head01__title").text().trim();
    $(section).find(".sc-head03__title a").each((_, el) => {
      const player = $(el).text().trim();
      results.push({ player, team });
    });
  });

  return results;
}

// ------------------- メイン処理 -------------------

async function updatePlayers() {
  const fetched = await fetchJapanesePlayers();
  const data = loadTeamData();
  const logs = [];
  const processed = new Set();

  for (const team of data.teams) {
    team.players = team.players || [];
    team.englishplayers = team.englishplayers || [];
  }

  for (const { player, team: newTeamName } of fetched) {
    processed.add(player);
    const matchedTeam = data.teams.find(t => isMatch(t.team, newTeamName) || isMatch(t.englishName, newTeamName));
    if (!matchedTeam) {
      logs.push({ type: "TeamMismatch", player, team: newTeamName });
      continue;
    }

    const idx = matchedTeam.players.indexOf(player);
    if (idx !== -1) {
      const currentEn = matchedTeam.englishplayers[idx];
      if (!currentEn || currentEn === "undefined") {
        const enName = await fetchEnglishName(player);
        matchedTeam.englishplayers[idx] = enName;
        logs.push({ type: "RetryUpdate", player, team: matchedTeam.team, details: enName });
      } else {
        logs.push({ type: "Unchanged", player, team: matchedTeam.team });
      }
      continue;
    }

    const enName = await fetchEnglishName(player);
    matchedTeam.players.push(player);
    matchedTeam.englishplayers.push(enName);
    logs.push({ type: "Added", player, team: matchedTeam.team, details: enName });
  }

  // 削除処理
  for (const team of data.teams) {
    const newJp = [];
    const newEn = [];
    for (let i = 0; i < team.players.length; i++) {
      const jp = team.players[i];
      const en = team.englishplayers[i];
      if (processed.has(jp)) {
        newJp.push(jp);
        newEn.push(en);
      } else {
        logs.push({ type: "Removed", player: jp, team: team.team });
      }
    }
    team.players = newJp;
    team.englishplayers = newEn;
  }

  saveTeamDataFormatted(data);
  writeCsvLog(logs);
  console.log("✔ 完了しました！");
  console.log("保存先:", DATA_PATH);
}

updatePlayers();
