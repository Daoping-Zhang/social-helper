import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg, downloadImage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Img, Loading, useToast, Badge } from '../components/ui.jsx';
import { PROJECT_STATUS, fmtTime } from '../labels.js';

const STAGES = {
  wash: ['正在分析照片', '正在生成画面', '正在优化细节', '即将完成'],
  faceswap: ['正在检测人脸', '正在融合五官', '正在优化细节', '即将完成'],
  enhance: ['正在高清放大', '正在优化纹理', '正在去除 AI 感', '即将完成'],
};

export default function ProjectFlow() {
  const { id } = useParams();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [showProcess, setShowProcess] = useState(false);
  const fileRef = useRef(null);
  const referenceFileRef = useRef(null);

  const refresh = async () => {
    const res = await api.get(`/api/projects/${id}`);
    setProject(res.data);
    return res.data;
  };

  useEffect(() => {
    api.get(`/api/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  // 处理中自动轮询
  useEffect(() => {
    if (!project) return;
    const processing = ['washing', 'faceswapping', 'enhancing'].includes(project.status);
    if (!processing) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [project?.status]);

  // 加载阶段文案轮播
  useEffect(() => {
    if (!project) return;
    const processing = ['washing', 'faceswapping', 'enhancing'].includes(project.status);
    if (!processing) return;
    setStageIdx(0);
    const t = setInterval(() => setStageIdx((i) => (i + 1) % 4), 1600);
    return () => clearInterval(t);
  }, [project?.status]);

  const doAction = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      await refreshUser().catch(() => {});
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startWash = () => doAction(() => api.post(`/api/projects/${id}/wash`));
  const reWash = () => {
    if (window.confirm('重新生成会消耗对应额度，是否继续？')) startWash();
  };
  const selectWash = (imageId) => doAction(() => api.post(`/api/projects/${id}/select-wash`, { imageId }));
  const startFaceswap = () => doAction(() => api.post(`/api/projects/${id}/faceswap`));
  const startEnhance = () => doAction(() => api.post(`/api/projects/${id}/enhance`));
  // 失败后按当前阶段重试对应环节
  const retry = () => {
    if (project.current_stage === 'faceswap') startFaceswap();
    else if (project.current_stage === 'enhance') startEnhance();
    else startWash();
  };

  const uploadFace = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('face', file);
    setBusy(true);
    try {
      await api.post(`/api/projects/${id}/face`, fd);
      await refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadReference = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('reference', file);
    setBusy(true);
    try {
      await api.post(`/api/projects/${id}/reference`, fd);
      await refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading text="加载项目…" />;
  if (!project) return <div className="empty">项目不存在</div>;

  const processing = ['washing', 'faceswapping', 'enhancing'].includes(project.status);
  const stageTexts = STAGES[project.current_stage] || STAGES.wash;
  const effectiveRef = project.user_reference || project.reference;

  const StepBar = () => (
    <div className="steps">
      {['参考图', '上传照片', '洗图', '换脸', '优化'].map((s, i) => {
        const doneIdx = project.final ? 4 : project.faceswap.length ? 3 : project.selected_wash ? 2 : project.face ? 1 : effectiveRef ? 0 : -1;
        return (
          <div key={s} className={`step ${i <= doneIdx ? 'done' : ''}`}>
            <span className="dot">{i < doneIdx ? '✓' : i + 1}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
  );

  if (processing) {
    return (
      <div className="user-content">
        <StepBar />
        <h2 style={{ textAlign: 'center' }}>
          {project.current_stage === 'wash' ? '正在生成候选照片' : project.current_stage === 'faceswap' ? '正在生成你的写真' : '正在进行最后的质感优化'}
        </h2>
        <div className="center" style={{ paddingTop: 30 }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
          <div className="loading-stages">
            {stageTexts.map((t, i) => (
              <div key={t} className={`stage ${i <= stageIdx ? 'on' : ''}`}>
                <span className="dot" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- 未上传参考照片 ----
  if (!project.reference && !project.user_reference) {
    return (
      <div className="user-content">
        <StepBar />
        <h2>上传参考照片</h2>
        <div className="small muted" style={{ marginBottom: 12 }}>
          上传一张你想生成同款风格的照片（人物姿势 / 场景 / 穿搭参考）
        </div>
        <label className="upload-zone" style={{ display: 'block' }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🖼️</div>
          <div>点击上传参考照片</div>
          <input
            ref={referenceFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => uploadReference(e.target.files[0])}
          />
        </label>
        <button className="btn btn-primary btn-block btn-lg mt16" disabled={busy} onClick={() => referenceFileRef.current?.click()}>
          {busy ? '上传中…' : '选择参考照片'}
        </button>
      </div>
    );
  }

  // ---- 未上传本人照片 ----
  if (!project.face) {
    return (
      <div className="user-content">
        <StepBar />
        <h2>上传你的照片</h2>
        <div className="card card-pad" style={{ background: 'var(--panel)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Img src={effectiveRef?.url} style={{ width: 80, height: 100, borderRadius: 8, objectFit: 'cover' }} />
            <div className="small muted" style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>参考照片</div>
              <div>{effectiveRef?.name || '用户上传的参考照片'}</div>
              {effectiveRef?.category && <div style={{ marginTop: 4 }}>分类：{effectiveRef.category}</div>}
            </div>
          </div>
        </div>
        <label className="upload-zone mt16" style={{ display: 'block' }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>📷</div>
          <div>拍照 / 从相册选择</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => uploadFace(e.target.files[0])}
          />
        </label>
        <ul className="upload-hint">
          <li>· 单人照片，正脸或接近正脸</li>
          <li>· 五官清晰，没有严重遮挡</li>
          <li>· 不戴墨镜，光线正常</li>
        </ul>
        <button className="btn btn-primary btn-block btn-lg mt16" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? '上传中…' : '选择照片'}
        </button>
      </div>
    );
  }

  // ---- 已上传，等待洗图 ----
  if (project.status === 'ready' || project.status === 'ready_for_faceswap') {
    const isReady = project.status === 'ready';
    return (
      <div className="user-content">
        <StepBar />
        {isReady ? (
          <>
            <h2>确认你的照片</h2>
            <Img src={project.face?.url} className="flow-img" />
            <div className="fixed-bottom">
              <div className="inner">
                <div className="small muted" style={{ marginBottom: 8 }}>本次洗图将消耗对应额度</div>
                <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={startWash}>
                  {busy ? '提交中…' : '开始生成'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2>已选择候选照片</h2>
            <Img src={project.selected_wash?.url} className="flow-img" />
            <div className="fixed-bottom">
              <div className="inner">
                <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={startFaceswap}>
                  {busy ? '提交中…' : '下一步：换成我的脸'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- 洗图结果选择 ----
  if (project.status === 'awaiting_selection') {
    return (
      <div className="user-content">
        <StepBar />
        <h2>选择你喜欢的一张</h2>
        <div className="candidate-grid">
          {project.wash.map((w) => (
            <div key={w.id} className={`candidate ${project.selected_wash?.id === w.id ? 'selected' : ''}`}>
              <Img src={w.url} onClick={() => selectWash(w.id)} />
              {project.selected_wash?.id === w.id && <span className="pick">已选择</span>}
              <div className="bar">
                <button className="btn btn-secondary btn-sm" onClick={() => selectWash(w.id)}>选择这张</button>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadImage(w.url, `wash-${w.id}.jpg`)}>下载</button>
              </div>
            </div>
          ))}
        </div>
        <div className="fixed-bottom">
          <div className="inner" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" disabled={busy} onClick={reWash}>重新生成一组</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={busy || !project.selected_wash}
              onClick={startFaceswap}
            >
              下一步：换成我的脸
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 换脸完成，等待优化 ----
  if (project.status === 'awaiting_enhance') {
    const fs = project.faceswap[0];
    return (
      <div className="user-content">
        <StepBar />
        <h2>换脸结果</h2>
        <Img src={fs?.url} className="flow-img" />
        <div className="fixed-bottom">
          <div className="inner" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => downloadImage(fs?.url, 'faceswap.jpg')}>下载当前版本</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={startEnhance}>继续优化 · 去 AI 感</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 失败 ----
  if (project.status === 'failed') {
    const lastTask = project.tasks.find((t) => t.status === 'failed');
    return (
      <div className="user-content">
        <StepBar />
        <h2>生成失败</h2>
        <div className="card card-pad">
          <div className="small muted">{lastTask?.error || '未知错误，请联系管理员'}</div>
          <button className="btn btn-primary btn-block mt16" onClick={retry}>重新尝试</button>
        </div>
      </div>
    );
  }

  // ---- 已完成 ----
  const finalImg = project.final;
  return (
    <div className="user-content" style={{ paddingBottom: 120 }}>
      <StepBar />
      <h2>最终照片</h2>
      <Img src={finalImg?.url} className="flow-img" />
      <div className="fixed-bottom">
        <div className="inner">
          <button className="btn btn-primary btn-block btn-lg" onClick={() => downloadImage(finalImg?.url, `final-${id}.jpg`)}>
            下载高清图片
          </button>
          <button className="btn btn-ghost btn-block mt8" onClick={() => setShowProcess((s) => !s)}>
            {showProcess ? '收起生成过程' : '查看生成过程'}
          </button>
        </div>
      </div>
      {showProcess && (
        <div className="card card-pad mt16">
          <div className="process-list">
            <ProcessItem label="参考照片" img={effectiveRef} dl />
            <ProcessItem label="本人照片" img={project.face} dl />
            <ProcessItem label="洗图候选（选中）" img={project.selected_wash} dl />
            {project.wash.map((w) => w.id !== project.selected_wash?.id && (
              <ProcessItem key={w.id} label="洗图候选" img={w} dl />
            ))}
            <ProcessItem label="换脸图片" img={project.faceswap[0]} dl />
            <ProcessItem label="最终图片" img={project.final} dl />
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessItem({ label, img, dl }) {
  if (!img) return null;
  return (
    <div className="process-item">
      <Img src={img.url} className="thumb" />
      <div className="info">
        <div className="label">{label}</div>
        {dl && (
          <button className="btn btn-ghost btn-sm" onClick={() => downloadImage(img.url, `${label}.jpg`)}>下载</button>
        )}
      </div>
    </div>
  );
}
