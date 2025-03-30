"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
const url_1 = require("url");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// .env.local を読み込む
const __dirname = (0, path_1.dirname)((0, url_1.fileURLToPath)(import.meta.url));
dotenv.config({ path: (0, path_1.resolve)(__dirname, '../.env.local') });
const serviceAccountJSON = process.env.FIREBASE_PRIVATE_KEY_JSON;
if (!serviceAccountJSON) {
    console.error("❌ FIREBASE_PRIVATE_KEY_JSON が .env.local に設定されていません");
    process.exit(1);
}
const serviceAccount = JSON.parse(serviceAccountJSON);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(serviceAccount),
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
        const userRecord = await firebase_admin_1.default.auth().getUser(uid);
        console.log(`✅ UID ${uid} のユーザー情報:`);
        console.log(JSON.stringify(userRecord, null, 2));
    }
    catch (error) {
        console.error("❌ ユーザー情報の取得に失敗:", error);
    }
    process.exit(0);
}
getUserInfo();
