import { NextResponse } from "next/server";
import admin from "@/firebase/admin";
import { adminDb } from "@/firebase/admin";
import { updateTimestamp } from "@/utils/updateLog";
import puppeteer, { Page } from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";

const URL =
  "https://www.transfermarkt.jp/serutikkufc/spielplan/verein/371/plus/0?saison_id=2024";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    console.log("✅ セルティック日程取得開始");

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "domcontentloaded" });

    // ✅ クッキーバナーを強制クリック（最大20秒リトライ）
    const popupSelector = "#onetrust-accept-btn-handler";
    const popupFound = await page.waitForSelector(popupSelector, { timeout: 10000 }).catch(() => null);

    if (popupFound) {
      await page.click(popupSelector);
      console.log("✅ クッキー同意ポップアップをクリック");
    } else {
      console.log("⚠ クッキー同意ポップアップが見つかりませんでした（スキップ）");
    }

    // ✅ 自動スクロールして描画を促す
    await autoScroll(page);

    // ✅ 最大30秒待ってテーブルを探す
    await page.waitForSelector("table.items tbody tr", { timeout: 30000 });

    // ✅ HTML と スクリーンショットを保存（デバッグ用）
    const html = await page.content();
    fs.writeFileSync("debug_celtic.html", html);
    await page.screenshot({ path: "debug_celtic.png", fullPage: true });

    const $ = cheerio.load(html);
    const rows = $("table.items tbody tr");
    console.log("✅ tr行数:", rows.length);

    const matches: any[] = [];

    rows.each((i, el) => {
      const cols = $(el).find("td");
      if (cols.length < 7) return;

      const dateStr = $(cols[1]).text().trim();
      const timeStr = $(cols[2]).text().trim();
      const opponent = $(cols[6]).text().trim();

      if (!dateStr || !timeStr || !opponent) return;

      const dateMatch = dateStr.match(/\d{4}\/\d{2}\/\d{2}/);
      if (!dateMatch) return;

      const fullDateStr = `${dateMatch[0]} ${timeStr}`;
      const kickoff = new Date(`${fullDateStr}:00 GMT+0000`);
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

    console.log("✅ 全試合数:", matches.length);

    if (matches.length === 0) {
      return NextResponse.json({ error: "有効な試合がありません" }, { status: 400 });
    }

    const batch = adminDb.batch();
    const ref = adminDb.collection("leagues").doc("celtic").collection("matches");

    for (const match of matches) {
      batch.set(ref.doc(match.matchId), match, { merge: true });
    }

    await batch.commit();
    await updateTimestamp("updateScraped_celtic");

    return NextResponse.json({ success: true, count: matches.length });
  } catch (err) {
    console.error("🔥 セルティック日程取得エラー:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// ⏬ 自動スクロール処理
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
