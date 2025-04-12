export const sendDiscordMessage = async (message: string, webhookEnvKey = "DISCORD_WEBHOOK_URL") => {
  const url = process.env[webhookEnvKey];
  if (!url) {
    console.error(`❌ Webhook URL が環境変数 ${webhookEnvKey} に設定されていません`);
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
