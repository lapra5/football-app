// src/pages/index.tsx
import LoginForm from "@/components/LoginForm";

export default function Home() {
  return (
    <div>
      <h1>Firebase + Next.js</h1>
      <LoginForm />
    </div>
  );
}

// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
