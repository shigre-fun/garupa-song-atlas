import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { siteSettings } from "../src/js/site-config.js";
const root = path.resolve("dist");
const prefix = siteSettings(process.env).basePath;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
http
  .createServer((req, res) => {
    let p;
    try {
      p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (prefix !== "/") {
      if (!p.startsWith(prefix)) {
        res.writeHead(404);
        return fs.createReadStream(path.join(root, "404.html")).pipe(res);
      }
      p = "/" + p.slice(prefix.length);
    }
    let f = path.resolve(root, "." + p);
    if (f !== root && !f.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory())
      f = path.join(f, "index.html");
    if (!fs.existsSync(f)) {
      res.writeHead(404, { "Content-Type": mime[".html"] });
      return fs.createReadStream(path.join(root, "404.html")).pipe(res);
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(f)] || "application/octet-stream",
    );
    fs.createReadStream(f).pipe(res);
  })
  .listen(4173, "127.0.0.1", () => console.log("Local: http://127.0.0.1:4173"));
