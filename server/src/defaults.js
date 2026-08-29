// 系统级 Workflow 默认参数（最底层默认值）
// 层级：System Default -> Admin Workflow Config -> Task Override
// 依据真实 RunningHub 工作流 JSON 校准：
//   - 洗图 = Z-Image-Turbo + Florence2 打标 + RepeatLatentBatch（一次提交产 N 张候选）
//   - 换脸 = InstantID + FaceDetailer + SeedVR2（输出 composite SaveImage 48）
//   - 去油腻 = SeedVR2 分块放大（输出 SaveImage 124）
module.exports = {
  workflows: {
    wash: {
      name: '洗图 Wash',
      description: '根据参考照片生成多张候选照片',
      credit_cost: 2,
      prompt: '', // 留空 => 由 Florence2 自动打标
      negative_prompt: '',
      params: {
        seed: null,
        steps: 10,
        cfg: 1,
        denoise: 0.5,
        candidateCount: 4, // RepeatLatentBatch.amount
        outputResolution: 1480, // scale_to_length（最长边）
      },
    },
    faceswap: {
      name: '换脸 Face Swap',
      description: '将用户五官身份特征应用到选中的洗图结果',
      credit_cost: 1,
      prompt:
        'a handsome man, professional portrait, natural skin, realistic photography, high detail, sharp focus',
      negative_prompt:
        'nsfw, worst quality, low quality, lowres, watermark, blur, deformed, bad anatomy, extra fingers, cartoon, 3d render, plastic skin',
      params: {
        seed: null,
        steps: 26,
        cfg: 1.8,
        denoise: 0.5,
        faceStrength: 1, // ApplyInstantID.weight
        outputResolution: 2048,
      },
    },
    enhance: {
      name: '质感优化 Enhance（去油腻）',
      description: '高清化、去 AI 感、提升真实纹理与细节',
      credit_cost: 2,
      prompt: '',
      negative_prompt: '',
      params: {
        outputResolution: 4096,
        seed: null,
        batchSize: 5,
        colorCorrection: 'lab',
        overlapRate: 0.15,
      },
    },
  },
  settings: {
    defaultCredits: 50,
  },
};
