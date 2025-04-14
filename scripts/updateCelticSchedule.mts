// scripts/updateCelticSchedule.mts
import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import dotenv from "dotenv";
import { updateTimestamp } from "../src/utils/updateLog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const URL = "https://www.transfermarkt.jp/serutikkufc/spielplan/verein/371/plus/0?saison_id=2024";
const webhookUrl = process.env.DISCORD_WEBHOOK_CELTIC;

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}

const main = async () => {
  try {
    console.log("🚀 セルティック日程取得開始");

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");
    await page.goto(URL, { waitUntil: "load", timeout: 60000 });

    const popupSelector = "#onetrust-accept-btn-handler";
    const popupFound = await page.waitForSelector(popupSelector, { timeout: 10000 }).catch(() => null);
    if (popupFound) await page.click(popupSelector);

    await autoScroll(page);
    await new Promise((r) => setTimeout(r, 8000));

    const html = await page.content();
    fs.writeFileSync("debug_celtic.html", html); // デバッグ用保存

    const $ = cheerio.load(html);
    const rows = $("table tbody tr");

    if (rows.length === 0) {
      throw new Error("❌ tr 要素が空です。HTML構造が変更された可能性があります。");
    }

    const matches: any[] = [];

    rows.each((_, el) => {
      const cols = $(el).find("td");
      if (cols.length < 7) return;

      const rawMatchday = $(cols[0]).text().trim(); // 例: "1."
      const matchdayParsed = parseInt(rawMatchday.replace(/\D/g, ""), 10);
      const matchday = isNaN(matchdayParsed) ? 0 : matchdayParsed;

      const rawDate = $(cols[1]).text().trim().replace(/[^\d/]/g, "");
      const timeStr = $(cols[2]).text().trim();
      const opponent = $(cols[6]).find("a").first().text().trim();

      if (!rawDate || !timeStr || !opponent) return;

      const kickoff = new Date(`${rawDate} ${timeStr}:00 GMT+0000`);
      if (isNaN(kickoff.getTime())) return;

      matches.push({
        matchId: `CELTIC_${kickoff.toISOString()}_vs_${opponent}`,
        kickoffTime: kickoff.toISOString(),
        homeTeam: { name: "セルティックFC", id: null, players: [] },
        awayTeam: { name: opponent, id: null, players: [] },
        league: "スコットランド",
        matchday,
        status: "SCHEDULED",
        lineupStatus: "未発表"
      });
    });

    await browser.close();

    const ref = db.collection("leagues").doc("celtic").collection("matches");
    const batch = db.batch();
    matches.forEach((match) => batch.set(ref.doc(match.matchId), match, { merge: true }));
    await batch.commit();

    console.log(`✅ セルティック試合 ${matches.length} 件を保存`);
    await sendDiscordMessage(`✅ セルティック試合 ${matches.length} 件を更新しました`, webhookUrl!);

    // JSON出力先のパス
    const outputPath = path.resolve(__dirname, "../src/data/current_month_matches_celtic.json");

    // Firestore保存後に追加：
    fs.writeFileSync(outputPath, JSON.stringify(matches, null, 2), "utf-8");
    console.log(`📝 ${outputPath} に ${matches.length} 件の試合を保存しました`);


    updateTimestamp("updateCelticSchedule");

  } catch (err) {
    console.error("❌ エラー:", err);
    await sendDiscordMessage(
      `❌ セルティック日程取得エラー: ${(err as Error).message}`,
      webhookUrl!
    );
    process.exit(1);
  }
};

main();
