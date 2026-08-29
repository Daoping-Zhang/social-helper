# 男士展示面 AI 写真平台 — MVP

移动端优先的男士 AI 写真生成平台。用户端极简（选参考图 → 上传照片 → 洗图 → 换脸 → 质感优化 → 下载），管理员端保留完整的运营与 AI 调优能力。

## 技术栈

- **后端**：Node.js + Express，内置 `node:sqlite`（零原生依赖，文件型数据库）
- **前端**：React 18 + Vite + React Router
- **图片存储**：本地文件夹（`data/`）
- **账号/数据**：SQLite 单文件（`data/app.db`）
- **AI 能力**：Provider 抽象接口 + Mock Provider（真实 RunningHub 接入点已预留）
- **部署**：单容器 Docker，`data/` 目录挂载为持久化卷

## 快速启动（Docker，推荐）

```bash
docker compose up -d --build
```

打开 <http://localhost:3000>。

> 宿主机端口冲突时，编辑 `docker-compose.yml` 中的 `"3000:3000"` 左侧端口即可。
> 所有持久化数据（数据库 + 上传/生成图片）都在宿主机 `./data` 目录。

## 本地开发

```bash
# 后端（默认端口 3000，可用 PORT 覆盖）
cd server && npm install && npm start

# 前端（开发服务器，代理到 3000）
cd web && npm install && npm run dev

# 生产构建（输出到 server/public，由后端托管）
cd web && npm run build
```

> npm 若提示缓存权限问题，可用 `npm install --cache <本地目录>` 指定可写缓存。

## 默认账号

| 角色   | 账号       | 密码      |
| ------ | ---------- | --------- |
| 管理员 | `admin`    | `admin123` |
| 用户   | `zhangsan` | `123456`  |

## 持久化目录结构

```
data/
├── app.db                  # SQLite 数据库（用户、项目、任务、额度、配置）
├── uploads/
│   ├── faces/              # 用户上传的本人照片
│   └── references/         # 管理员上传的参考照片
├── generated/
│   ├── wash/               # 洗图候选
│   ├── faceswap/           # 换脸结果
│   └── enhance/            # 最终优化结果
└── .mock/jobs/             # Mock Provider 的任务状态
```

删除容器重建时，只要保留 `data/` 卷，数据就不会丢失。

## 环境变量

| 变量          | 默认值                        | 说明                         |
| ------------- | ----------------------------- | ---------------------------- |
| `PORT`        | `3000`                        | 服务端口                     |
| `DATA_DIR`    | `<repo>/data`                 | 数据目录（持久化）           |
| `JWT_SECRET`  | `dev-secret-change-me`        | JWT 密钥（生产务必修改）     |
| `AI_PROVIDER` | `mock`                        | AI Provider，见下             |
| `MOCK_DURATION_MS` | `3500`                   | Mock 任务模拟耗时             |
| `RH_API_KEY`  | —                             | RunningHub API Key            |
| `RH_BASE_URL` | `https://www.runninghub.cn`   | RunningHub 基础地址           |
| `RH_WORKFLOW_ID_WASH`     | — | 洗图工作流 ID（RunningHub 后台导出） |
| `RH_WORKFLOW_ID_FACESWAP` | — | 换脸工作流 ID                 |
| `RH_WORKFLOW_ID_ENHANCE`  | — | 质感优化工作流 ID             |

## AI Provider 抽象

AI 能力统一抽象为两个方法，位于 `server/src/ai/`：

```js
provider.submitWorkflow({ workflowType, inputs, parameters }) -> { externalTaskId }
provider.getTaskStatus(externalTaskId, { workflowType }) -> { status: 'running'|'success'|'failed', images?, error? }
```

- `MockProvider`：本地模拟（默认），复制输入图作为输出，用于无外部依赖跑通全流程。
- `RunningHubProvider`：真实 RunningHub 接入，已按官方文档实现（见下）。

### 参数层级

```
System Workflow Default  →  Admin Workflow Config  →  Task Override
```

由 `server/src/params.js` 的 `resolveParams()` 合并；管理员修改 Workflow 默认值记录在 `param_changelogs`。

## RunningHub 接入（已实现并已联调通过）

已完成 `RunningHubProvider`，并用真实 API Key + 工作流跑通了「上传 → 提交 → 轮询 → 下载」全链路（洗图 2 候选成功产出 2 张 1480×1480 结果）。实现见 `server/src/ai/runningHubProvider.js`、`server/src/ai/workflowMapping.js`。

| 能力 | 端点 |
| ---- | ---- |
| 上传图片 | `POST /task/openapi/upload`（form：`apiKey` + `file` + `fileType=image`）→ `data.fileName`（`api/xxx` 前缀，用于 LoadImage） |
| 提交任务 | `POST /task/openapi/create`（body：`apiKey` + `workflowId` + `nodeInfoList`）→ `data.taskId` |
| 查询状态 | `POST /task/openapi/status`（body：`apiKey` + `taskId`）→ `data` 为 `QUEUED/RUNNING/SUCCESS/FAILED` |
| 查询结果 | `POST /task/openapi/outputs`（body：`apiKey` + `taskId`）→ `data[].fileUrl`（按 SaveImage 节点过滤） |

> workflowId 获取方式：浏览器打开工作流，地址栏 `workflow/` 后面那串数字即是（`?source=workspace` 去掉）。

节点映射（`workflowMapping.js`，依据三份最新工作流 JSON）：

| 产品参数 | 洗图 wash | 换脸 faceswap | 去油腻 enhance |
| -------- | --------- | ------------- | -------------- |
| 架构 | Z-Image-Turbo + Florence2 + RepeatLatentBatch | InstantID + FaceDetailer + SeedVR2 | SeedVR2 分块放大 |
| 输入图 | `203.image`（参考图） | `15.image`(人脸) + `21.image`(目标) | `88.image` |
| 候选数量 | `206.value`（RepeatLatentBatch.amount） | — | — |
| Prompt | `263.text_input`（Florence2，留空自动打标） | `6.text` | — |
| 负向 Prompt | — | `7.text` | — |
| seed / steps / cfg | `218.*`（KSampler） | `24.*`（FaceDetailer） | `153.seed` |
| denoise | `205.value` | `24.denoise` | — |
| 人脸相似度 | — | `11.weight` | — |
| 输出分辨率 | `204.value`（scale_to_length） | `126.value` | `142.value` |
| batch_size / 色彩校正 / overlap | — | — | `153.batch_size` / `153.color_correction` / `132.overlap_rate` |
| 输出 SaveImage 节点 | `208` | `119`（SeedVR2 放大后的换脸结果） | `124` |

### 关键结论（依据你提供的最新工作流）

1. **洗图「多候选」是 workflow 内的 `RepeatLatentBatch`**（node 206 `value`=候选数量），**一次提交即产 N 张**，不需要多次提交。
2. **三个工作流确实不同**：洗图是 Z-Image-Turbo 重绘 + Florence2 自动打标；换脸是 InstantID 换脸 + SeedVR2 放大（输出 node 119）；去油腻是 SeedVR2 分块放大。
3. **换脸 Prompt 需注意**：工作流默认是 `a cute [girl]...`，平台默认值已改为男士写真 Prompt，并会强制覆盖。
4. **taskId 必须按字符串处理**（int64 超 JS 精度）。
5. 色彩校正「关闭」的 SeedVR2 枚举值未确认，当前 `off` 时不上报该字段（保持工作流默认）。

### 如何切到真实 RunningHub

1. 拿到 API Key（API → API 密钥）和三个 workflowId（工作流地址栏数字）。
2. 复制 `.env.example` 为 `.env`，填入真实值（项目根目录已放好 `.env`，`docker compose` 会自动读取）：

```bash
AI_PROVIDER=runninghub
RH_API_KEY=你的key
RH_WORKFLOW_ID_WASH=2091435731393794049
RH_WORKFLOW_ID_FACESWAP=2091435880740384770
RH_WORKFLOW_ID_ENHANCE=2091435754496024577
```

3. 先跑连通性测试（上传一张图，验证 key 与 workflow，约 1-2 分钟）：

```bash
RH_API_KEY=你的key RH_WORKFLOW_ID_WASH=2091435731393794049 \
  node server/scripts/test-runninghub.js ./某张图.png wash 2
```

4. 通过后 `docker compose up -d --build` 即可。

### 联调实测记录（2026-08-28）

- 洗图 `candidateCount` 由 node `206.value` 控制：`2` → 出 2 张、`4` → 出 4 张，均已验证。
- 洗图输出分辨率 node `204.value`(scale_to_length)=1480 → 出图确为 1480×1480。
- 上传必须用经典 `/task/openapi/upload`（返回 `api/` 前缀 fileName）；v2 `/openapi/v2/media/upload/binary` 返回的 `openapi/` 前缀不适用 LoadImage。
- 洗图单次约 15 RH 币、耗时约 75 秒。

## 核心数据关系

```
User
└── Project
    ├── Reference Image
    ├── Face Image
    ├── Wash Task        → Candidate Images[]
    ├── Face Swap Task   → Face Swap Image
    └── Enhance Task     → Final Image
```

## 目录结构

```
server/            Express + node:sqlite 后端
  src/
    routes/        auth / user / admin
    ai/            provider 抽象 + mock
    aiService.js   任务提交与轮询
    params.js      参数层级合并
    paramSchema.js 后台参数定义与校验
web/               React 前端（用户端 + 管理后台）
Dockerfile         多阶段构建
docker-compose.yml 单容器 + 持久化卷
```
