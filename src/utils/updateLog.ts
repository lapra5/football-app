// src/utils/updateLog.ts
import fs from "fs";
import path from "path";

const logPath = path.resolve(process.cwd(), "src/data/updated_log.json");

export function updateTimestamp(key: string) {
  const now = new Date().toISOString();
  const data = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : {};
  data[key] = now;
  fs.writeFileSync(logPath, JSON.stringify(data, null, 2), "utf-8");
}
