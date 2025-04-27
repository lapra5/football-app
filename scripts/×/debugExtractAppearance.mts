// scripts/debugExtractAppearance.mts
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");

const JAPANESE_PLAYERS_URL = "https://soccer.yahoo.co.jp/ws/japanese/players";

const extractAppearanceInfo = async () => {
  const res = await fetch(JAPANESE_PLAYERS_URL);
  const html = await res.text();
  const $ = cheerio.load(html);
  const appearances: any[] = [];

  $(".sc-player").each((i, el) => {
    const name = $(el).find("h3 a").text().trim();
    const rows = $(el).find("table tbody tr");

    rows.each((j, row) => {
      const cols = $(row).find("td");
      const matchdayStr = $(cols[0]).text().trim().replace("第", "").replace("節", "");
      const kickoffRaw = $(cols[1]).text().trim(); // e.g. "4/21（月）27:45"
      const statusStr = $(cols[4]).text().trim();

      const matchday = parseInt(matchdayStr, 10);
      if (isNaN(matchday) || !kickoffRaw) return;

      const match = kickoffRaw.match(/(\d+)\/(\d+).*?(\d+):(\d+)/);
      if (!match) return;
      const [_, month, day, hour, minute] = match.map(Number);
      const adjustedHour = hour >= 24 ? hour - 24 : hour;
      const date = dayjs.tz(`2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${adjustedHour}:${minute}`, "Asia/Tokyo");
      const kickoff = date.utc().format("YYYY-MM-DDTHH:mm");

      let status: "starter" | "sub" | "benchOut" | null = null;
      if (statusStr.includes("先発")) status = "starter";
      else if (statusStr.includes("途中")) status = "sub";
      else if (statusStr.includes("ベンチ外")) status = "benchOut";

      if (status) {
        appearances.push({ name, matchday, kickoff, status });
      }
    });
  });

  console.log("📋 appearances 件数:", appearances.length);
  console.log("🧾 sample:", appearances.slice(0, 5));
};

extractAppearanceInfo();
