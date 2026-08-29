import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export function startServer(options = {}) {
  const rootDir = options.rootDir || __dirname;
  const dataDir = options.dataDir || path.join(rootDir, 'data');
  const port = options.port ?? 3344;
  const host = options.host || '127.0.0.1';
  const noExit = options.noExit === true;

  fs.mkdirSync(dataDir, { recursive: true });
  const dataFile = path.join(dataDir, 'data.json');
  const backupFile = path.join(dataDir, 'data.backup.json');

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 20 * 1024 * 1024) {
          req.destroy();
          reject(new Error('body too large'));
        }
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  function isValidData(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj) && obj.version !== undefined;
  }

  function writeJsonAtomic(file, obj) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function saveWithBackup(data) {
    if (!isValidData(data)) throw new Error('invalid data: missing version');
    if (fs.existsSync(dataFile)) {
      fs.copyFileSync(dataFile, backupFile);
    }
    writeJsonAtomic(dataFile, data);
  }

  function loadData() {
    let recovered = false;
    const fileExists = fs.existsSync(dataFile);
    let raw = null;
    try {
      raw = fs.readFileSync(dataFile, 'utf8');
      JSON.parse(raw);
    } catch {
      raw = null;
    }
    if (raw === null) {
      try {
        const bak = fs.readFileSync(backupFile, 'utf8');
        JSON.parse(bak);
        fs.writeFileSync(dataFile, bak, 'utf8');
        return { data: JSON.parse(bak), recovered: true, fileExists: true };
      } catch {
        if (!fs.existsSync(dataFile)) {
          // 全新安装：创建占位文件，保证数据文件存在（内容由首次保存时补全）
          writeJsonAtomic(dataFile, { version: 1 });
        }
        return { data: null, recovered: false, fileExists: fs.existsSync(dataFile) };
      }
    }
    return { data: JSON.parse(raw), recovered: false, fileExists: true };
  }

  function sendJson(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      pathname = req.url || '/';
    }

    try {
      if (req.method === 'GET' && pathname === '/api/data') {
        const { data, recovered, fileExists } = loadData();
        sendJson(res, 200, { ok: true, data, recovered, fileExists });
        return;
      }
      if (req.method === 'POST' && pathname === '/api/data') {
        const body = await readBody(req);
        const data = JSON.parse(body);
        saveWithBackup(data);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/info') {
        sendJson(res, 200, { ok: true, dataFile, dataDir });
        return;
      }
      if (req.method === 'GET' && pathname === '/api/export') {
        const { data } = loadData();
        const out = data || { version: 1 };
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="data.json"',
        });
        res.end(JSON.stringify(out, null, 2));
        return;
      }
      if (req.method === 'POST' && pathname === '/api/import') {
        const body = await readBody(req);
        const data = JSON.parse(body);
        if (!isValidData(data)) throw new Error('invalid data: missing version');
        saveWithBackup(data);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && pathname === '/api/shutdown') {
        sendJson(res, 200, { ok: true });
        setTimeout(() => {
          server.close();
          server.closeAllConnections?.();
          if (!noExit) setTimeout(() => process.exit(0), 50);
        }, 50);
        return;
      }
      if (req.method === 'GET') {
        let filePath;
        if (pathname === '/') filePath = path.join(rootDir, 'index.html');
        else filePath = path.join(rootDir, pathname);
        const rel = path.relative(rootDir, filePath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('forbidden');
          return;
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(fs.readFileSync(filePath));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('method not allowed');
    } catch (err) {
      sendJson(res, 400, { ok: false, error: String(err.message || err) });
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve({ server, port: server.address().port, dataDir, dataFile, backupFile });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { server, port, dataFile } = await startServer({ port: 3344 });
  console.log(`工作生活APP 已启动: http://127.0.0.1:${port}`);
  console.log(`数据文件: ${dataFile}`);
  server.on('error', (err) => console.error('服务错误:', err.message));
}