# 去 AI 感 / 皮肤质感增强 — RunningHub 适配版

根据 Liblib 工作流「毛孔级真实皮肤质感添加 提升皮肤细节 去除AI感 Kontext增加人像皮肤纹理 +wan2.2放大」的**说明与网站默认参数**重建，可直接导入 RunningHub。

> ⚠️ 说明：Liblib 的工作流 JSON 需登录才能导出，无法匿名获取原始节点图。本文件是基于该工作流的描述 + 网站推荐参数重建的**标准 ComfyUI 工作流**，模型文件名是**占位符**，需按你实际上传到 RunningHub 的模型名替换。

## 一、网站默认参数（已按此设置）

| 参数 | 网站默认 | 本工作流节点 |
| ---- | -------- | ------------ |
| 采样方法 | Euler | `8.sampler_name = euler` |
| 迭代步数 | 20-25 | `8.steps = 22` |
| 提示词引导系数 CFG | 3.5 | `8.cfg = 3.5` |
| LoRA 权重 | 0.8-1.0 | `3.strength_model/clip = 0.85` |
| 出图尺寸 | 1024×1500 / 1500×1024 | `6.width/height = 1024×1500` |
| 推荐提示词 | 模型名称 | `4.text`（已按此填写） |
| 重绘强度 denoise | （网站未给出） | `8.denoise = 0.4`（可调） |

## 二、接入 RunningHub 步骤

1. **上传模型**（RunningHub → 模型库）：
   - 一个大模型（F1 / Flux / Kontext 系，`.safetensors`）
   - 一个「皮肤质感 / 去 AI 感」LoRA（`.safetensors`）
2. **导入工作流**：RunningHub 后台 → 我的工作流 → 新建/导入 → 选择 `去AI感-皮肤质感增强.json`
3. **替换模型名**：把 `2.ckpt_name` 和 `3.lora_name` 改成你实际上传的模型文件名
4. **网页端先手动跑通一次**（RunningHub 要求工作流先手动出图成功，API 才能调用）
5. 在 RunningHub 后台导出「工作流 API」，拿到 workflowId

## 三、动态节点（接入平台时需要）

| 用途 | 节点 |
| ---- | ---- |
| 输入图 | `1.image`（LoadImage） |
| 随机种子 | `8.seed`（KSampler，留空自动随机） |
| 皮肤质感 LoRA 权重 | `3.strength_model` / `3.strength_clip` |
| 放大尺寸 | `10.width/height`（默认 2048×3000，可换 SeedVR2 / Wan2.2） |
| 输出图 | `11`（SaveImage） |

## 四、接入现有平台（二选一）

**方式 A：替换「去油腻 enhance」**
把拿到的 workflowId 填到 `.env`：

```bash
RH_WORKFLOW_ID_ENHANCE=新的workflowId
```

然后告诉我这个工作流的动态节点编号（默认就是我上面写的 1/8/10），我把 `workflowMapping.js` 里 enhance 的映射改成这一套即可。

**方式 B：作为第 4 个独立工作流（皮肤质感）**
告诉我要新增的工作流类型名，我加一个 `skin_enhance` 流程 + 后台配置页。

## 五、效果不佳时调整

- 出图偏糊/没质感 → `8.denoise` 调高到 0.5-0.6
- 变化太大不像本人 → `8.denoise` 调低到 0.25-0.35
- 皮肤纹理太强/太弱 → `3.strength_model` 在 0.8-1.0 间调
