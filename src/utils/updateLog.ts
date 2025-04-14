import fs from "fs";
import path from "path";

/**
 * `src/data/updated_log.json` にスクリプトの実行日時を記録する関数
 * @param key スクリプト名（例: "updateTeamsMeta"）
 */
export function updateTimestamp(key: string) {
  const logPath = path.resolve("src/data/updated_log.json");
  const now = new Date().toISOString();

  // 既存のログを読み込み（なければ空オブジェクト）
  const logData = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : {};

  // 実行日時を上書き
  logData[key] = now;

  // 保存
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), "utf-8");
  console.log(`🕒 updated_log.json に ${key}: ${now} を記録しました`);
}
