import { NextResponse } from "next/server";
import admin from "@/firebase/admin";
import { adminDb } from "@/firebase/admin";
import * as cheerio from "cheerio";
import axios from "axios";
import { updateTimestamp } from "@/utils/updateLog";

const J_URLS = [
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=1&competition_ids=651&tv_relay_station_name=",
    league: "J1",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=2",
    league: "J2",
  },
  {
    url: "https://data.j-league.or.jp/SFMS01/search?competition_years=2025&competition_frame_ids=3",
    league: "J3",
  },
];

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const allMatches: any[] = [];

    for (const { url, league } of J_URLS) {
      const res = await axios.get(url);
      const $ = cheerio.load(res.data);

      $(".data_table tr").each((_, el) => {
        const cols = $(el).find("td");
        if (cols.length < 8) return;

        const dateStr = $(cols[0]).text().trim(); // 例: 02/25（土）
        const timeStr = $(cols[1]).text().trim(); // 例: 14:00
        const homeTeam = $(cols[4]).text().trim();
        const awayTeam = $(cols[6]).text().trim();

        if (!dateStr || !timeStr || !homeTeam || !awayTeam) return;

        const fullDateTimeStr = `2025/${dateStr} ${timeStr}`;
        const kickoff = new Date(`${fullDateTimeStr}:00 GMT+0900`);

        if (isNaN(kickoff.getTime())) return; // 日付変換に失敗した場合はスキップ

        allMatches.push({
          matchId: `${league}_${kickoff.toISOString()}_${homeTeam}_vs_${awayTeam}`,
          kickoffTime: kickoff.toISOString(),
          homeTeam: { name: homeTeam, id: null, players: [] },
          awayTeam: { name: awayTeam, id: null, players: [] },
          league,
          matchday: 0,
          status: "SCHEDULED",
          lineupStatus: "未発表",
        });
      });
    }

    const batch = adminDb.batch();
    const ref = adminDb.collection("leagues").doc("jleague").collection("matches");
    for (const match of allMatches) {
      batch.set(ref.doc(match.matchId), match, { merge: true });
    }

    await batch.commit();
    await updateTimestamp("updateScraped_jleague");

    return NextResponse.json({ success: true, count: allMatches.length });
  } catch (err) {
    console.error("🔥 Jリーグ日程取得エラー:", err);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
