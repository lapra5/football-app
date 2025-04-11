console.log("🔔 discordNotify モジュール読み込み");

export const sendDiscordMessage = async (message: string) => {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.error("❌ DISCORD_WEBHOOK_URL が設定されていません");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    if (!res.ok) {
      console.error(`❌ Discord通知失敗: ${res.status} ${res.statusText}`);
    } else {
      console.log("✅ Discord通知成功");
    }
  } catch (err) {
    console.error("❌ Discord通知エラー:", err);
  }
};
