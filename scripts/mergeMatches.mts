import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 読み込むJSONファイルのパス
const sources = [
  path.resolve(__dirname, "../src/data/current_month_matches.json"), // 元の月間データ（海外）
  path.resolve(__dirname, "../src/data/current_month_matches_jleague.json"),
  path.resolve(__dirname, "../src/data/current_month_matches_celtic.json"),
];

// 出力先
const outputPath = path.resolve(__dirname, "../src/data/current_month_matches.json");

const main = () => {
  try {
    const mergedMatches: any[] = [];

    for (const filePath of sources) {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ ファイルが存在しません: ${filePath}`);
        continue;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const matches = JSON.parse(raw);
      mergedMatches.push(...matches);
    }

    // キックオフ順にソート（任意）
    mergedMatches.sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());

    fs.writeFileSync(outputPath, JSON.stringify(mergedMatches, null, 2), "utf-8");
    console.log(`✅ ${mergedMatches.length} 試合を統合し、保存しました → ${outputPath}`);
  } catch (err) {
    console.error("❌ 統合処理中にエラー:", err);
    process.exit(1);
  }
};

main();
