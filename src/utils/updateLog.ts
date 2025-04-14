import fs from "fs";
import path from "path";

/**
 * `updated_log.json` にスクリプトの実行日時を追記（マージ）する
 */
export function updateTimestamp(key: string) {
  const logPath = path.resolve("src/data/updated_log.json");
  const now = new Date().toISOString();

  const logData = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : {};

  logData[key] = now;

  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), "utf-8");
  console.log(`🕒 updated_log.json に ${key}: ${now} を記録しました`);
}
