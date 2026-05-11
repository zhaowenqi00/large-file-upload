const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const multer = require('@koa/multer');
const path = require('path');
const fs = require('fs');
const serve = require('koa-static');

// ============================================================
//  初始化
// ============================================================
const app = new Koa();
const router = new Router();

// 静态文件目录（前端代码）
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// 文件存储目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CHUNKS_DIR = path.join(__dirname, 'chunks');
const METADATA_DIR = path.join(__dirname, 'metadata');

// 确保目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(METADATA_DIR)) fs.mkdirSync(METADATA_DIR, { recursive: true });

// ============================================================
//  中间件：日志
// ============================================================
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ctx.status} - ${ms}ms`);
});

// ============================================================
//  中间件：条件 bodyParser（JSON）
//  不使用全局 bodyParser，避免与 multer 的 multipart 解析冲突
// ============================================================
app.use(async (ctx, next) => {
  const needBodyParser = (ctx.path === '/upload/merge' && ctx.method === 'POST')
    || (ctx.path === '/files/delete' && ctx.method === 'POST');
  if (needBodyParser) {
    return bodyParser()(ctx, next);
  }
  return next();
});

// ============================================================
//  配置 multer：使用 memoryStorage，body 和文件数据都在内存中
//  然后在路由处理器中手动写文件到正确的 hash 目录
// ============================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 根路径重定向到 index.html
router.get('/', (ctx) => {
  ctx.redirect('/index.html');
});

// ============================================================
//  接口：秒传检查
//  GET /check?hash=<md5>&size=<size>&name=<name>
// ============================================================
router.get('/check', (ctx) => {
  const { hash, size, name } = ctx.query;

  if (!hash) {
    ctx.status = 400;
    ctx.body = { error: '缺少 hash 参数' };
    return;
  }

  const mergedPath = path.join(UPLOAD_DIR, name);
  const metaPath = path.join(METADATA_DIR, `${hash}.json`);

  if (fs.existsSync(mergedPath) && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (meta.hash === hash && meta.name === name && String(meta.size) === String(size)) {
      ctx.body = { exists: true };
      return;
    }
  }

  ctx.body = { exists: false };
});

// ============================================================
//  接口：上传分片
//  POST /upload
//  FormData: chunk, hash, chunkIndex, totalChunks, filename, fileSize
// ============================================================
router.post('/upload', upload.single('chunk'), (ctx) => {
  const { hash, chunkIndex, totalChunks, filename, fileSize } = ctx.request.body;

  if (!ctx.file) {
    ctx.status = 400;
    ctx.body = { error: '未收到分片文件' };
    return;
  }

  // 将分片写入到正确的 hash 目录
  const destDir = path.join(CHUNKS_DIR, hash);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, String(chunkIndex));
  fs.writeFileSync(destPath, ctx.file.buffer);

  console.log(
    `  [分片 ${parseInt(chunkIndex) + 1}/${totalChunks}] ${filename} (${fileSize} bytes) - hash: ${hash}`
  );

  ctx.body = {
    success: true,
    chunkIndex: parseInt(chunkIndex),
    received: ctx.file.size,
  };
});

// ============================================================
//  接口：合并分片
//  POST /upload/merge
//  JSON: { hash, name, totalChunks }
// ============================================================
router.post('/upload/merge', async (ctx) => {
  const { hash, name, totalChunks } = ctx.request.body;

  if (!hash || !name || !totalChunks) {
    ctx.status = 400;
    ctx.body = { error: '缺少必要参数: hash, name, totalChunks' };
    return;
  }

  const chunksDir = path.join(CHUNKS_DIR, hash);
  const outputPath = path.join(UPLOAD_DIR, name);
  const metaPath = path.join(METADATA_DIR, `${hash}.json`);

  // 等待分片全部到达（最多等3秒，每200ms检查一次）
  const maxWait = 3000;
  const interval = 200;
  let waited = 0;
  while (waited < maxWait) {
    let allReady = true;
    for (let i = 0; i < totalChunks; i++) {
      if (!fs.existsSync(path.join(chunksDir, String(i)))) {
        allReady = false;
        break;
      }
    }
    if (allReady) break;
    await new Promise(r => setTimeout(r, interval));
    waited += interval;
  }

  // 验证所有分片
  const missing = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!fs.existsSync(path.join(chunksDir, String(i)))) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {
    ctx.status = 500;
    ctx.body = { error: `分片 ${missing.join(',')} 不存在 (已等待 ${waited}ms)` };
    return;
  }

  // 合并文件
  const writeStream = fs.createWriteStream(outputPath);
  let totalWritten = 0;

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = fs.readFileSync(path.join(chunksDir, String(i)));
      writeStream.write(chunkData);
      totalWritten += chunkData.length;
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 合并完成后删除分片目录
    fs.rmSync(chunksDir, { recursive: true, force: true });

    if (!fs.existsSync(METADATA_DIR)) fs.mkdirSync(METADATA_DIR, { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify({ hash, name, size: totalWritten }, null, 2));

    console.log(`\n[合并完成] ${name} (${totalWritten} bytes) -> ${outputPath}\n`);

    ctx.body = {
      success: true,
      path: outputPath,
      size: totalWritten,
      url: `/uploads/${encodeURIComponent(name)}`,
    };
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: err.message };
  }
});

// ============================================================
//  接口：下载已合并的文件
//  GET /uploads/<filename>
// ============================================================
router.get('/uploads/:filename', (ctx) => {
  const filename = decodeURIComponent(ctx.params.filename);
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    ctx.status = 404;
    ctx.body = { error: '文件不存在' };
    return;
  }

  ctx.type = path.extname(filename);
  ctx.body = fs.createReadStream(filePath);
});

// ============================================================
//  接口：列出所有已上传文件
//  GET /files
// ============================================================
router.get('/files', (ctx) => {
  if (!fs.existsSync(METADATA_DIR)) {
    ctx.body = { files: [] };
    return;
  }

  const metaFiles = fs.readdirSync(METADATA_DIR).filter(f => f.endsWith('.json'));
  const files = metaFiles.map(f => {
    const meta = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, f), 'utf-8'));
    return {
      hash: meta.hash,
      name: meta.name,
      size: meta.size,
      uploadedAt: fs.statSync(path.join(METADATA_DIR, f)).mtime.toISOString(),
      url: `/uploads/${encodeURIComponent(meta.name)}`,
    };
  });

  ctx.body = { files };
});

// ============================================================
//  接口：删除文件（文件和对应 metadata）
//  POST /files/delete
//  JSON: { hash, name }
// ============================================================
router.post('/files/delete', (ctx) => {
  const { hash, name } = ctx.request.body;

  if (!hash || !name) {
    ctx.status = 400;
    ctx.body = { error: '缺少 hash 或 name 参数' };
    return;
  }

  const filePath = path.join(UPLOAD_DIR, name);
  const metaPath = path.join(METADATA_DIR, `${hash}.json`);
  let deleted = false;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
    deleted = true;
  }

  ctx.body = { success: true, deleted };
});

// ============================================================
//  启动
// ============================================================
app.use(router.routes());
app.use(router.allowedMethods());

// 静态文件服务（作为 fallback，匹配所有未由 API 处理的请求）
app.use(serve(CLIENT_DIR));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  文件上传服务已启动`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`  前端页面: ${CLIENT_DIR}`);
  console.log(`  分片存储目录: ${CHUNKS_DIR}`);
  console.log(`  合并文件目录: ${UPLOAD_DIR}\n`);
});
