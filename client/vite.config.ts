import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        allowedHosts: [
            "localhost",
            "127.0.0.1",
            "constrain-kerchief-levitate.ngrok-free.dev",
            ".ngrok-free.dev",
            ".ngrok.io"
        ],
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    preview: {
        host: "0.0.0.0",
        port: 4173,
        strictPort: true,
        allowedHosts: [
            "localhost", 
            "127.0.0.1",
            "constrain-kerchief-levitate.ngrok-free.dev",
            ".ngrok-free.dev",
            ".ngrok.io"
        ],
    },
});
