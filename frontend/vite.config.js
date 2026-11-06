import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
    // страница #/docs импортирует ../docs/*.md — разрешаем dev-серверу читать корень репозитория
    fs: { allow: [".."] },
  },
});
