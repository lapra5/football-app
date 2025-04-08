import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// .env.local を読み込む
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

// ✅ BASE64形式の秘密鍵を使用
const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!base64) {
  console.error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が .env.local に設定されていません");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString());
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
} catch (e) {
  console.error("❌ Firebase サービスアカウントの読み込みに失敗しました:", e);
  process.exit(1);
}

// Firebase 初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 引数から UID を受け取る
const uid = process.argv[2];
if (!uid) {
  console.error("❌ UID を指定してください。");
  console.error("例: npm run get-user-info <UID>");
  process.exit(1);
}

// ユーザー情報取得
async function getUserInfo() {
  try {
    const userRecord = await admin.auth().getUser(uid);
    console.log(`✅ UID ${uid} のユーザー情報:`);
    console.log(JSON.stringify(userRecord, null, 2));
  } catch (error) {
    console.error("❌ ユーザー情報の取得に失敗:", error);
  }
  process.exit(0);
}

getUserInfo();
