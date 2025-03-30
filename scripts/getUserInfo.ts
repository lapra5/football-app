import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// .env.local を読み込む
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const serviceAccountJSON = process.env.FIREBASE_PRIVATE_KEY_JSON;
if (!serviceAccountJSON) {
  console.error("❌ FIREBASE_PRIVATE_KEY_JSON が .env.local に設定されていません");
  process.exit(1);
}
const serviceAccount = JSON.parse(serviceAccountJSON);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const uid = process.argv[2];

if (!uid) {
  console.error("❌ UID を指定してください。");
  console.error("例: npm run get-user-info <UID>");
  process.exit(1);
}

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
