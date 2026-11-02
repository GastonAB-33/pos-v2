import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { handleArcaBillingRequest } from "./src/server/arca-server-handler";

function arcaBillingDevPlugin(): Plugin {
  return {
    name: "arca-billing-dev-plugin",
    configureServer(server) {
      server.middlewares.use("/functions/v1/arca-billing", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          });
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let rawBody = "";
        req.on("data", (chunk) => {
          rawBody += chunk;
        });

        req.on("end", async () => {
          try {
            const body = JSON.parse(rawBody || "{}");
            const result = await handleArcaBillingRequest(body);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(500, {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: err?.message || "Error procesando solicitud ARCA en servidor de desarrollo",
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), arcaBillingDevPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
