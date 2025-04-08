import { NextResponse } from "next/server";
import admin from "@/firebaseAdmin";
import { db } from "@/firebase/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { updateTimestamp } from "@/utils/updateLog";

const filePath = path.resolve(process.cwd(), "src/data/team_league_names.json");
const teamLeagueNames = JSON.parse(fs.readFileSync(filePath, "utf-8"));
const leagueIds = [2013, 2016, 2021, 2015, 2002, 2019, 2003, 2017, 2014, 2001];

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const allResults: { matchId: string; message: string }[] = [];
    const now = new Date();
    let updatedCount = 0;

    for (const leagueId of leagueIds) {
      const snapshot = await getDocs(collection(db, `leagues/${leagueId}/matches`));

      for (const docSnap of snapshot.docs) {
        const matchData = docSnap.data();
        const kickoff = new Date(matchData.kickoffTime);
        const matchIdStr = matchData.id.toString();

        const homeTeam = teamLeagueNames.teams.find((t) => t.teamId === matchData.homeTeam.id);
        const awayTeam = teamLeagueNames.teams.find((t) => t.teamId === matchData.awayTeam.id);
        const isJapaneseTeam = (homeTeam?.players?.length ?? 0) > 0 || (awayTeam?.players?.length ?? 0) > 0;

        const within30min = now >= new Date(kickoff.getTime() - 30 * 60 * 1000);

        let message = "";

        if (!matchData.lineupStatus || matchData.lineupStatus === "未発表") {
          if (isJapaneseTeam && within30min) {
            const matchRes = await fetch(
              `https://api.football-data.org/v4/matches/${matchData.id}`,
              { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY! } }
            );
            const matchJson = await matchRes.json();

            const homeLineup = matchJson.homeTeam?.lineup ?? [];
            const homeBench = matchJson.homeTeam?.bench ?? [];
            const awayLineup = matchJson.awayTeam?.lineup ?? [];
            const awayBench = matchJson.awayTeam?.bench ?? [];

            const updateData: any = {
              lineupStatus: "発表済み",
            };

            // 日本人選手分類
            if (homeTeam?.players?.length) {
              const allNames = homeTeam.players.map((p: any) => typeof p === 'string' ? p : p.en);
              const startingNames = homeLineup.map((p: any) => p.name);
              const subNames = homeBench.map((p: any) => p.name);

              updateData.homeTeam = {
                ...matchData.homeTeam,
                startingMembers: allNames.filter((name) => startingNames.includes(name)),
                substitutes: allNames.filter((name) => subNames.includes(name)),
                outOfSquad: allNames.filter((name) => !startingNames.includes(name) && !subNames.includes(name)),
              };
            }

            if (awayTeam?.players?.length) {
              const allNames = awayTeam.players.map((p: any) => typeof p === 'string' ? p : p.en);
              const startingNames = awayLineup.map((p: any) => p.name);
              const subNames = awayBench.map((p: any) => p.name);

              updateData.awayTeam = {
                ...matchData.awayTeam,
                startingMembers: allNames.filter((name) => startingNames.includes(name)),
                substitutes: allNames.filter((name) => subNames.includes(name)),
                outOfSquad: allNames.filter((name) => !startingNames.includes(name) && !subNames.includes(name)),
              };
            }

            // ✅ Firestoreに保存（失敗したら即中断）
            try {
              await setDoc(doc(db, `leagues/${leagueId}/matches`, matchIdStr), updateData, { merge: true });
              message = "発表済みに更新";
              updatedCount++;
            } catch (firestoreErr) {
              console.error("❌ Firestore保存失敗:", firestoreErr);
              throw new Error("Firestoreへの保存で失敗。処理中断。");
            }
          }
        }

        if (message) {
          allResults.push({ matchId: matchIdStr, message });
        }
      }
    }

    updateTimestamp("updateLineups");
    console.log(`🟢 スタメン更新完了：${updatedCount} 件`);
    return NextResponse.json({ results: allResults, updatedCount });
  } catch (err) {
    console.error("🔥 ラインアップ更新エラー:", err);
    return NextResponse.json({ error: "サーバーエラー", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
