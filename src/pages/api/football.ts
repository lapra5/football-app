// pages/api/football.js
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const response = await fetch("https://api.football-data.org/v4/matches", {
            headers: {
                "X-Auth-Token": process.env.FOOTBALL_API_KEY, // 環境変数にAPIキーを保存
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching football data:", error.message);
        res.status(500).json({ message: "サッカー情報の取得に失敗しました。" });
    }
}
