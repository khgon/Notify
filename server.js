const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { verifyBirthDate } = require("./functions/verifyDob");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change-this-secret";
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 300);

const allowedPeople = [
  {
    name: process.env.ALLOWED_PERSON_NAME || "홍길동",
    birthDate: process.env.ALLOWED_PERSON_BIRTHDATE || "1990-01-01",
  },
];

const DOC_DIR = path.join(__dirname, "doc");
const PUBLIC_DIR = path.join(__dirname, "public");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) {
    return { ok: false, reason: "invalid_token_format" };
  }

  const [data, signature] = token.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(data)
    .digest("base64url");

  if (signature !== expectedSignature) {
    return { ok: false, reason: "invalid_signature" };
  }

  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));

  if (Date.now() > payload.exp) {
    return { ok: false, reason: "token_expired" };
  }

  return { ok: true, payload };
}

function getSafeDocPath(fileName) {
  const normalized = path.normalize(fileName).replace(/^([.][.][/\\])+/, "");
  const fullPath = path.join(DOC_DIR, normalized);
  if (!fullPath.startsWith(DOC_DIR)) {
    return null;
  }
  return fullPath;
}

function serveStaticFile(filePath, res) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
          ? "application/javascript; charset=utf-8"
          : "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const currentUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && (currentUrl.pathname === "/" || currentUrl.pathname === "/index.html")) {
    return serveStaticFile(path.join(PUBLIC_DIR, "index.html"), res);
  }

  if (req.method === "POST" && currentUrl.pathname === "/api/verify-dob") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const result = verifyBirthDate(
          { name: data.name, birthDate: data.birthDate },
          allowedPeople,
        );

        if (!result.ok) {
          return sendJson(res, 401, { ok: false, reason: result.reason });
        }

        const targetPdf = typeof data.fileName === "string" ? data.fileName : "sample.pdf";
        const docPath = getSafeDocPath(targetPdf);

        if (!docPath || !fs.existsSync(docPath) || path.extname(docPath).toLowerCase() !== ".pdf") {
          return sendJson(res, 404, { ok: false, reason: "pdf_not_found" });
        }

        const token = signToken({
          fileName: targetPdf,
          name: result.person.name,
          exp: Date.now() + TOKEN_TTL_SECONDS * 1000,
        });

        return sendJson(res, 200, {
          ok: true,
          message: "verified",
          pdfUrl: `/pdf/${encodeURIComponent(targetPdf)}?token=${encodeURIComponent(token)}`,
          expiresInSeconds: TOKEN_TTL_SECONDS,
        });
      } catch (error) {
        return sendJson(res, 400, { ok: false, reason: "invalid_json" });
      }
    });

    return;
  }

  if (req.method === "GET" && currentUrl.pathname.startsWith("/pdf/")) {
    const token = currentUrl.searchParams.get("token");
    const tokenResult = verifyToken(token);

    if (!tokenResult.ok) {
      return sendJson(res, 401, { ok: false, reason: tokenResult.reason });
    }

    const requestedFile = decodeURIComponent(currentUrl.pathname.replace("/pdf/", ""));

    if (requestedFile !== tokenResult.payload.fileName) {
      return sendJson(res, 403, { ok: false, reason: "token_file_mismatch" });
    }

    const filePath = getSafeDocPath(requestedFile);
    if (!filePath || !fs.existsSync(filePath)) {
      return sendJson(res, 404, { ok: false, reason: "pdf_not_found" });
    }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
      "Cache-Control": "no-store",
    });

    return fs.createReadStream(filePath).pipe(res);
  }

  if (req.method === "GET" && currentUrl.pathname.startsWith("/public/")) {
    const requested = currentUrl.pathname.replace("/public/", "");
    return serveStaticFile(path.join(PUBLIC_DIR, requested), res);
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`PDF server running on http://${HOST}:${PORT}`);
});
