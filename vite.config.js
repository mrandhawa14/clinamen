import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const page = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
	plugins: [cloudflare()],
	build: {
		rollupOptions: {
			input: { main: page("./index.html"), island: page("./island.html"), assets: page("./assets.html") },
		},
	},
});
