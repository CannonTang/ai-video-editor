#!/usr/bin/env node

import { createReadStream, realpathSync, stat } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const MIME_TYPES = new Map([
  [".aac", "audio/aac"],
  [".bin", "application/octet-stream"],
  [".css", "text/css; charset=utf-8"],
  [".data", "application/octet-stream"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".onnx", "application/octet-stream"],
  [".png", "image/png"],
  [".safetensors", "application/octet-stream"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".vtt", "text/vtt; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function parseArguments(argv) {
  const options = { host: "127.0.0.1", port: 4173, root: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--root" && value) {
      options.root = value;
      index += 1;
    } else if (argument === "--host" && value) {
      options.host = value;
      index += 1;
    } else if (argument === "--port" && value) {
      options.port = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!options.root) throw new Error("--root is required");
  if (options.host !== "127.0.0.1") {
    throw new Error("Timeline Studio Local may only listen on 127.0.0.1");
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error("--port must be an integer between 1024 and 65535");
  }
  options.root = realpathSync(options.root);
  return options;
}

function parseRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!match || (!match[1] && !match[2])) return null;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : fileSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }
  return { start, end: Math.min(end, fileSize - 1) };
}

function cacheControl(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (
    extension === ".html" ||
    extension === ".webmanifest" ||
    filePath.endsWith("model-cache-sw.js")
  ) {
    return "no-cache";
  }
  return "public, max-age=31536000, immutable";
}

function baseHeaders(filePath) {
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl(filePath),
    "Content-Type": MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Timeline-Studio-Local": "1",
  };
}

function sendFile(request, response, filePath, fileStat) {
  const headers = baseHeaders(filePath);
  const requestedRange = request.headers.range;
  const range = requestedRange ? parseRange(requestedRange, fileStat.size) : null;

  if (requestedRange && !range) {
    response.writeHead(416, { ...headers, "Content-Range": `bytes */${fileStat.size}` });
    response.end();
    return;
  }

  if (range) {
    response.writeHead(206, {
      ...headers,
      "Content-Length": range.end - range.start + 1,
      "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}`,
    });
    if (request.method === "HEAD") response.end();
    else
      createReadStream(filePath, range)
        .on("error", () => response.destroy())
        .pipe(response);
    return;
  }

  response.writeHead(200, { ...headers, "Content-Length": fileStat.size });
  if (request.method === "HEAD") response.end();
  else
    createReadStream(filePath)
      .on("error", () => response.destroy())
      .pipe(response);
}

function statFile(filePath) {
  return new Promise((resolveStat) => {
    stat(filePath, (error, fileStat) => {
      resolveStat(!error && fileStat.isFile() ? fileStat : null);
    });
  });
}

const options = parseArguments(process.argv.slice(2));
const rootPrefix = `${options.root}${sep}`;
const allowedHosts = new Set([`${options.host}:${options.port}`, `localhost:${options.port}`]);

const server = createServer(async (request, response) => {
  if (!allowedHosts.has(request.headers.host || "")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url || "/", `http://${request.headers.host}`).pathname,
    );
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const relativePath = pathname.replace(/^\/+/, "") || "index.html";
  const requestedPath = resolve(options.root, relativePath);
  if (requestedPath !== options.root && !requestedPath.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const requestedStat = await statFile(requestedPath);
  if (requestedStat) {
    sendFile(request, response, requestedPath, requestedStat);
    return;
  }

  if (!(request.headers.accept || "").includes("text/html")) {
    response.writeHead(404, { "X-Timeline-Studio-Local": "1" });
    response.end("Not found");
    return;
  }

  const fallbackPath = resolve(options.root, "index.html");
  const fallbackStat = await statFile(fallbackPath);
  if (!fallbackStat) {
    response.writeHead(500, { "X-Timeline-Studio-Local": "1" });
    response.end("Timeline Studio build is missing");
    return;
  }
  sendFile(request, response, fallbackPath, fallbackStat);
});

server.on("error", (error) => {
  console.error(`Timeline Studio Local failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(options.port, options.host, () => {
  console.log(
    `Timeline Studio Local serving ${options.root} at http://${options.host}:${options.port}/`,
  );
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { baseHeaders, parseArguments, parseRange };
