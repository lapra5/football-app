import fetch from "node-fetch";

export const sendDiscordMessage = async (content: string, webhookUrl?: string) => {
  const url = webhookUrl || process.env.DISCORD_WEBHOOK_URL_CURRENT_MONTH_MATCH;

  if (!url) {
    console.error("❌ Webhook URL が環境変数 DISCORD_WEBHOOK_URL_CURRENT_MONTH_MATCH に設定されていません");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.error(`❌ Discord通知に失敗しました: ${response.statusText}`);
    }
  } catch (error) {
    console.error("❌ Discord通知中にエラーが発生しました:", error);
  }
};
