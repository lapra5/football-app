import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { sendDiscordMessage } from "../src/utils/discordNotify.ts";
import dotenv from "dotenv";
import { readFileSync } from "fs";

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
    await new Promise((r) => setTimeout(r, 8000)); // ← 待機時間を 5秒 → 8秒 に増加

    // まず table.items の存在確認（tr は後でチェック）
    const tableFound = await page.waitForSelector("table.items", { timeout: 30000 }).catch(() => null);
    if (!tableFound) {
      const html = await page.content();
      fs.writeFileSync("debug_celtic_error.html", html);
      throw new Error("❌ セレクタが見つかりません: table.items");
    }

    const html = await page.content();
    fs.writeFileSync("debug_celtic.html", html);

    const $ = cheerio.load(html);
    const rows = $("table.items tbody tr");

    if (rows.length === 0) {
      throw new Error("❌ tr 要素が空です。HTML構造が変更された可能性があります。");
    }

    const matches: any[] = [];

    rows.each((_, el) => {
      const cols = $(el).find("td");
      if (cols.length < 7) return;

      const dateStr = $(cols[1]).text().trim();
      const timeStr = $(cols[2]).text().trim();
      const opponent = $(cols[6]).text().trim();

      const dateMatch = dateStr.match(/\d{4}\/\d{2}\/\d{2}/);
      if (!dateMatch || !timeStr || !opponent) return;

      const kickoff = new Date(`${dateMatch[0]} ${timeStr}:00 GMT+0000`);
      if (isNaN(kickoff.getTime())) return;

      matches.push({
        matchId: `CELTIC_${kickoff.toISOString()}_vs_${opponent}`,
        kickoffTime: kickoff.toISOString(),
        homeTeam: { name: "セルティックFC", id: null, players: [] },
        awayTeam: { name: opponent, id: null, players: [] },
        league: "スコットランド",
        matchday: 0,
        status: "SCHEDULED",
        lineupStatus: "未発表",
      });
    });

    await browser.close();

    const ref = db.collection("leagues").doc("celtic").collection("matches");
    const batch = db.batch();
    matches.forEach((match) => batch.set(ref.doc(match.matchId), match, { merge: true }));
    await batch.commit();

    console.log(`✅ セルティック試合 ${matches.length} 件を保存`);
    await sendDiscordMessage(`✅ セルティック試合 ${matches.length} 件を更新しました`, webhookUrl!);
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
