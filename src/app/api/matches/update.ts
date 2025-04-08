import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const leagueId = searchParams.get("leagueId");
    const matchId = searchParams.get("matchId");

    try {
        if (type === "fetchMatchesByLeague" && leagueId) {
            const response = await fetch(
                `https://api.football-data.org/v4/competitions/${leagueId}/matches`,
                { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY as string } }
              );
              if (!response.ok) {
                return NextResponse.json({ error: "リーグ試合データ取得失敗" }, { status: response.status });
              }
              const data = await response.json();
              return NextResponse.json(data);
            }

        if (type === "fetchLineup" && matchId) {
            const response = await fetch(
                `https://api.football-data.org/v4/competitions/${leagueId}/matches`,
                { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_KEY as string } }
              );
              if (!response.ok) {
                return NextResponse.json({ error: "リーグ試合データ取得失敗" }, { status: response.status });
              }
              const data = await response.json();
              return NextResponse.json(data);
            }

        return NextResponse.json({ error: "パラメータ不足か不正リクエスト" }, { status: 400 });
    } catch (error) {
        console.error("API ルートエラー:", error);
        return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
    }
}
