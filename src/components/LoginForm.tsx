// src/components/LoginForm.tsx
import { useState } from "react";
import { login } from "@/firebase/auth";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      alert("ログイン成功");
    } catch (error) {
      console.error(error);
      alert("ログイン失敗");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">ログイン</button>
    </form>
  );
}
