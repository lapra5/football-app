import { auth } from "@/firebase/firebase";

export const refreshUserClaims = async () => {
  const user = auth.currentUser;
  if (user) {
    try {
      // getIdToken(true) で強制的に新しいトークンを取得
      await user.getIdToken(true);
      console.log("✅ カスタムクレームが更新されました");
    } catch (err) {
      console.error("カスタムクレーム更新時エラー", err);
    }
  }
};
