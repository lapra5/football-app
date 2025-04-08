import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

// ✅ base64形式からデコード
const base64 = process.env.FIREBASE_PRIVATE_KEY_JSON_BASE64;
if (!base64) {
  console.error("❌ FIREBASE_PRIVATE_KEY_JSON_BASE64 が .env.local に設定されていません");
  process.exit(1);
}

const jsonString = Buffer.from(base64, 'base64').toString();
const serviceAccount = JSON.parse(jsonString);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const uid = process.argv[2];
if (!uid) {
  console.error("❌ UID を指定してください。");
  console.error("例: npm run set-admin <UID>");
  process.exit(1);
}

async function setAdminClaim() {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ UID ${uid} に admin: true を付与しました！`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  }
  process.exit(0);
}

setAdminClaim();
