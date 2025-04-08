// wikidataJapaneseAutoFill.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, "team_league_names.json");
const outputPath = path.resolve(__dirname, "team_league_names_translated.json");
const raw = fs.readFileSync(inputPath, "utf-8");
const data = JSON.parse(raw);

async function fetchWikidataId(englishName) {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    englishName
  )}&language=en&format=json`;

  try {
    const res = await fetch(searchUrl);
    const json = await res.json();
    if (json.search && json.search.length > 0) {
      return json.search[0].id;
    }
  } catch (err) {
    console.error(`❌ Wikidata検索エラー: ${englishName}`, err);
  }
  return null;
}

async function fetchJapaneseLabel(wikidataId) {
  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;

  try {
    const res = await fetch(entityUrl);
    const json = await res.json();
    return json.entities[wikidataId]?.labels?.ja?.value || null;
  } catch (err) {
    console.error(`❌ Wikidata詳細取得エラー: ${wikidataId}`, err);
  }
  return null;
}

async function main() {
  for (const team of data.teams) {
    if (!team.team || team.team.trim() === "") {
      console.log(`🔎 ${team.englishName} の日本語名を検索中...`);
      const wikidataId = await fetchWikidataId(team.englishName);
      if (wikidataId) {
        const jaLabel = await fetchJapaneseLabel(wikidataId);
        if (jaLabel) {
          console.log(`✅ ${team.englishName} → ${jaLabel}`);
          team.team = jaLabel;
        } else {
          console.log(`⚠️ ${team.englishName} は日本語ラベルが見つかりません`);
        }
      } else {
        console.log(`❌ ${team.englishName} はWikidataに見つかりません`);
      }
    } else {
      console.log(`スキップ: ${team.englishName}（すでに日本語名あり）`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
  console.log("🎉 完了！ team_league_names_translated.json に保存しました。");
}

main();
