import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

// ESModules用の__dirname取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, "team_league_names.json");
const outputPath = path.resolve(__dirname, "team_league_names_free.json");
const raw = fs.readFileSync(filePath, "utf-8");
const data = JSON.parse(raw);

async function getWikimediaImage(teamName) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&generator=search&gsrsearch=${encodeURIComponent(teamName)} flag|banner&gsrlimit=5&iiprop=url|extmetadata`;
  
  try {
    const res = await fetch(searchUrl);
    const json = await res.json();

    if (!json.query?.pages) return null;

    // 候補の中から「商用利用可 (CC BY-SA 3.0 / CC0 / Public Domain)」のものだけを探す
    const pages = Object.values(json.query.pages);
    for (const page of pages) {
      const license = page.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value || "";
      const url = page.imageinfo?.[0]?.url || "";

      if (
        license.includes("CC BY-SA") ||
        license.includes("CC0") ||
        license.includes("Public domain")
      ) {
        return url;
      }
    }
  } catch (err) {
    console.error(`❌ Wikimedia検索エラー: ${teamName}`, err);
  }
  return null;
}

async function main() {
  const results = [];

  for (const team of data.teams) {
    console.log(`➡️ ${team.team} のロゴまたはフラッグ画像を検索中...`);
    let logoUrl = `https://crests.football-data.org/${team.teamId}.svg`;

    // 一度公式ロゴURLをHEADリクエストで存在確認
    const headRes = await fetch(logoUrl, { method: "HEAD" });
    if (!headRes.ok) {
      // ロゴが存在しない場合 → Wikimediaから検索
      console.log(`⚠️ ${team.team} の公式ロゴなし。Wikimediaから代替検索...`);
      logoUrl = await getWikimediaImage(team.team);
      if (logoUrl) {
        console.log(`✅ ${team.team} に代替画像取得: ${logoUrl}`);
      } else {
        console.log(`❌ ${team.team} に代替画像も見つからず`);
        logoUrl = "";
      }
    }

    results.push({
      teamId: team.teamId,
      team: team.team,
      players: team.players,
      logo: logoUrl,
    });
  }

  // 保存
  const finalJson = JSON.stringify({ teams: results }, null, 2);
  fs.writeFileSync(outputPath, finalJson, "utf-8");

  console.log(`✨ 完了！ team_league_names_free.json に保存しました`);
}

main();
