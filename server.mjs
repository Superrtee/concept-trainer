import { exec } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePairs } from "./src/generator.mjs";
import { loadFamilies } from "./src/load.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const families = loadFamilies(path.join(root, "data", "families"));
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(new Error("Request is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}`);

  if (req.method === "GET" && url.pathname === "/api/families") {
    const summary = families.map((family) => ({
      id: family.id,
      label: family.label,
      slots: family.slots.map((slot) => slot.id),
    }));
    send(res, 200, JSON.stringify(summary), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const body = JSON.parse(String(await readBody(req)) || "{}");
      const text = generatePairs({
        concept: body.concept,
        count: body.count,
        families,
      });
      send(res, 200, text, "text/plain; charset=utf-8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate pairs.";
      const status = message.startsWith("Concept") || message.startsWith("Pair") || message.startsWith("Keep") ? 400 : 500;
      send(res, status, message);
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed.");
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden.");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found.");
      return;
    }
    const type = types[path.extname(filePath)] || "application/octet-stream";
    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end();
      return;
    }
    send(res, 200, data, type);
  });
});

server.listen(port, host, () => {
  const openUrl = `http://${host}:${port}`;
  console.log(`ConceptTrainer  ${openUrl}`);
  if (process.env.NO_OPEN === "1") return;
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd /c start" : "xdg-open";
  exec(`${command} ${JSON.stringify(openUrl)}`, () => {});
});
