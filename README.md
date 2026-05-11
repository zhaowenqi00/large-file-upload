# 大文件分片上传系统

一个全栈式大文件上传解决方案，支持分片上传、秒传验证（基于 MD5）、暂停/恢复功能，以及服务端文件管理。

## 功能特性

- **分片上传**：自动将大文件分割为 2MB 的分片，确保上传可靠性
- **秒传验证**：使用 MD5 哈希值检测文件是否已存在服务器
- **暂停/恢复**：随时暂停和继续上传任务
- **分片重试**：自动重试上传失败的分片
- **并发上传**：支持同时上传多个文件（最多 3 个并发）
- **进度追踪**：实时显示上传进度、速度和哈希计算进度
- **服务端文件管理**：查看和删除已上传的文件

## 技术栈

**前端：**
- React 18
- Vite 5

**后端：**
- Node.js
- Koa 
- Koa Router
- Multer（文件处理）
- Koa Static（静态文件服务）

## 项目结构

```
large-file-upload/
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   │   ├── ActionBar.jsx
│   │   │   ├── FileCard.jsx
│   │   │   ├── FileListPanel.jsx
│   │   │   ├── ServerFileCard.jsx
│   │   │   └── Toast.jsx
│   │   ├── App.jsx         # 主应用组件
│   │   ├── config.js       # 配置文件
│   │   ├── uploadHook.js   # 上传逻辑 Hook
│   │   ├── md5.js          # MD5 计算
│   │   ├── utils.js        # 工具函数
│   │   └── style.css       # 样式文件
│   ├── vite.config.js      # Vite 配置
│   └── package.json
├── server/                  # 后端 Koa 应用
│   ├── server.js           # 主服务器文件
│   ├── uploads/            # 合并后的上传文件
│   ├── chunks/             # 临时分片存储
│   └── metadata/           # 文件元数据（哈希、名称、大小）
└── README.md
```

## 安装

### 环境要求

- Node.js >= 14
- npm 或 yarn

### 安装步骤

1. **安装服务端依赖：**
   ```bash
   cd server
   npm install
   ```

2. **安装前端依赖：**
   ```bash
   cd client
   npm install
   ```

## 运行项目

### 启动服务端

```bash
cd server
npm start
```

服务将在 `http://localhost:3000` 启动

### 启动前端（开发模式）

```bash
cd client
npm run dev
```

前端将在 `http://localhost:5173` 启动，并代理 API 请求到服务端。

### 生产构建

```bash
cd client
npm run build
```

构建产物将输出到 `client/dist/`。服务端会自动从 `client` 目录提供这些静态文件。

## API 接口

| 方法 | 接口 | 描述 |
|--------|----------|-------------|
| GET | `/check?hash=<md5>&size=<size>&name=<name>` | 检查文件是否已存在（秒传验证） |
| POST | `/upload` | 上传文件分片（multipart/form-data） |
| POST | `/upload/merge` | 合并所有分片为最终文件 |
| GET | `/files` | 列出所有已上传文件 |
| GET | `/uploads/:filename` | 下载已上传的文件 |
| POST | `/files/delete` | 删除文件 |

## 上传流程

1. **选择文件**：用户选择要上传的文件
2. **MD5 计算**：在浏览器中计算文件哈希值（显示进度）
3. **秒传检查**：发送哈希到服务器检查文件是否存在
   - 如果存在：文件立即标记为完成（秒传成功）
   - 如果不存在：继续分片上传
4. **分片上传**：
   - 文件分割为 2MB 的分片
   - 顺序上传每个分片
   - 服务器将分片存储在 `chunks/<hash>/` 目录
5. **合并**：所有分片上传完成后，合并为最终文件
6. **清理**：删除临时分片文件

## 配置说明

编辑 `client/src/config.js` 修改以下配置：

```javascript
CHUNK_SIZE: 2 * 1024 * 1024,        // 分片大小：2MB
LARGE_FILE_THRESHOLD: 2 * 1024 * 1024, // 大文件阈值：超过此大小启用分片上传
MAX_CONCURRENT_FILES: 3,             // 最大并发上传文件数
MAX_CONCURRENT_CHUNKS: 3,            // 最大并发分片数（预留）
MAX_RETRIES: 3,                       // 每个分片最大重试次数
```

## 开源协议

MIT
