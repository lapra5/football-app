// src/utils/discordNotify.ts
import fetch from 'node-fetch';

/**
 * Discordにメッセージを送信する関数
 * @param message - 通知内容
 * @param webhookUrl - 通知を送信するWebhook URL（Discordのもの）
 */
export const sendDiscordMessage = async (
  message: string,
  webhookUrl: string
) => {
  if (!webhookUrl) {
    console.warn("⚠️ Webhook URLが未定義です。通知をスキップします。");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    console.log("✅ Discord通知送信成功");
  } catch (error) {
    console.error("❌ Discord通知送信失敗", error);
  }
};
