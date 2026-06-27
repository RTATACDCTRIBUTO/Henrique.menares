const http = require("http");
const fs = require("fs");
const path = require("path");

const root = "C:\\Users\\User\\Documents\\site hne";
const port = 8137;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const cleanPath = decodeURIComponent(url.pathname === "/" ? "/indexadm.html" : url.pathname);
    const filePath = path.resolve(root, cleanPath.replace(/^[/\\]+/, ""));
    const rootPath = path.resolve(root);

    if (!filePath.startsWith(rootPath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, { "content-type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      response.end(data);
    });
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Painel admin: http://127.0.0.1:${port}/indexadm.html`);
});
