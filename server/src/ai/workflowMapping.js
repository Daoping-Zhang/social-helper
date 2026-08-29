// RunningHub ComfyUI Workflow 节点映射（依据最新三份真实工作流 JSON）
//
// 1) 洗图 wash（Z-Image-Turbo + Florence2 打标 + RepeatLatentBatch，一次提交产 N 张候选）
//    - 203 LoadImage.image                      输入参考图
//    - 206 easy int.value = 4                   RepeatLatentBatch.amount = 候选数量
//    - 205 easy float.value = 0.5               denoise
//    - 204 easy int.value = 1480                scale_to_length（输出边长）
//    - 218 KSampler.seed / steps / cfg
//    - 263 Florence2Run.text_input              可选 prompt 覆盖（留空自动打标）
//    - 208 SaveImage                            输出
//
// 2) 换脸 faceswap（InstantID + FaceDetailer + SeedVR2）
//    - 15 LoadImage.image                       身份/人脸图（InstantID 源）
//    - 21 LoadImage.image                       目标图（composite destination）
//    - 6 / 7 CLIPTextEncode.text                正 / 负 Prompt
//    - 11 ApplyInstantID.weight                 人脸相似度
//    - 24 FaceDetailer.seed / steps / cfg / denoise
//    - 47 LoraLoader.strength_model / strength_clip
//    - 126 easy int.value                       输出分辨率（SeedVR2）
//    - 48 SaveImage（composite 结果）           输出（另有 111 同图、119 为 SeedVR2 放大版）
//
// 3) 去油腻 enhance（SeedVR2 分块放大）
//    - 88 LoadImage.image                       输入图（换脸结果）
//    - 142 easy int.value = 4096                输出分辨率
//    - 153 SeedVR2.seed / batch_size / color_correction
//    - 132 TTP_Tile_image_size.overlap_rate
//    - 124 SaveImage                            输出

module.exports = {
  wash: {
    image: '203',
    candidateCount: '206',
    denoise: '205',
    scaleToLength: '204',
    seed: '218',
    steps: '218',
    cfg: '218',
    prompt: '263',
    saveNodeId: '208',
  },
  faceswap: {
    imageIdentity: '15',
    imageTarget: '21',
    prompt: '6',
    negative: '7',
    faceStrength: '11',
    seed: '24',
    steps: '24',
    cfg: '24',
    denoise: '24',
    loraModel: '47',
    loraClip: '47',
    outputResolution: '126',
    attentionMode: '123', // SeedVR2LoadDiTModel（工作流里 attention_mode 被存成了 false，需覆盖为 sdpa）
    saveNodeId: '119', // SaveImage（SeedVR2 放大后的换脸结果）
  },
  enhance: {
    image: '88',
    outputResolution: '142',
    seed: '153',
    batchSize: '153',
    colorCorrection: '153',
    overlapRate: '132',
    saveNodeId: '124',
  },
};
