// 🚀 changePassword.mts

import * as readline from "readline";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// 🔧 環境変数読み込み
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64!, "base64").toString()
);

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

// 🔧 設定
const EMAIL_DOMAIN = "@example.com"; // ← あなたのアプリに合わせてここだけ直せます

// 🧠 対話プロンプト設定
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 🔥 メイン処理
const main = async () => {
  try {
    console.log("🔐 パスワード変更モード開始");

    const userId = await question("ユーザーIDを入力してください（@より前のみ）: ");
    const email = userId + EMAIL_DOMAIN;

    const currentPassword = await question("現在のパスワードを入力してください: ");
    const newPassword = await question("新しいパスワードを入力してください: ");

    console.log(`🧩 メールアドレス: ${email}`);
    console.log("🔎 ユーザー検索中...");

    const userRecord = await auth.getUserByEmail(email);

    if (!userRecord) {
      console.error("❌ ユーザーが見つかりませんでした");
      process.exit(1);
    }

    // 直接パスワードをチェックできないので、ここでは更新だけ行う
    await auth.updateUser(userRecord.uid, { password: newPassword });

    console.log("✅ パスワード変更が完了しました！");
  } catch (err) {
    console.error("❌ エラー発生:", err);
    process.exit(1);
  } finally {
    rl.close();
  }
};

// 🔁 質問ユーティリティ
function question(text: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

main();
