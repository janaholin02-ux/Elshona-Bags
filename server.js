const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE_DIR = path.resolve(__dirname);

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function sendResponse(res, statusCode, data, contentType) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(data);
}

function serveFile(reqPath, res) {
  let filePath = path.join(BASE_DIR, reqPath);

  if (!filePath.startsWith(BASE_DIR)) {
    sendResponse(res, 403, 'Forbidden', 'text/plain');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      sendResponse(res, 404, 'Not Found', 'text/plain');
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        sendResponse(res, 404, 'Not Found', 'text/plain');
        return;
      }

      sendResponse(res, 200, content, getContentType(filePath));
    });
  });
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = requestPath === '/' ? '/index.html' : requestPath;

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
