// src/firebaseAdmin.ts

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let admin;

if (typeof window === "undefined") { // ← これ追加（ビルド時サーバーのみ初期化）
  const serviceAccountBase64 = process.env.FIREBASE_ADMIN_BASE64;

  if (!serviceAccountBase64) {
    console.warn("⚠️ FIREBASE_ADMIN_BASE64 が未設定のため firebase-admin を初期化しません。");
  } else {
    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
    );

    const app = getApps().length ? getApp() : initializeApp({
      credential: cert(serviceAccount),
    });

    admin = {
      app,
      db: getFirestore(app),
      auth: () => getAuth(app),
    };
  }
}

export { admin };
export default admin;
