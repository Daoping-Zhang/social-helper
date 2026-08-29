import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { Img, Modal, Loading, useToast } from '../components/ui.jsx';

export default function Home() {
  const [refs, setRefs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cat, setCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const load = async (category = '') => {
    setLoading(true);
    try {
      const res = await api.get('/api/references', { params: category ? { category } : {} });
      setRefs(res.data.references);
      if (!category) setCategories(res.data.categories || []);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(''); }, []);

  const pickCategory = (c) => {
    setCat(c);
    load(c);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/api/projects', { referenceImageId: selected.id });
      navigate(`/projects/${res.data.id}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const createOwnReference = async () => {
    setBusy(true);
    try {
      const res = await api.post('/api/projects', {});
      navigate(`/projects/${res.data.id}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="user-content" style={{ paddingBottom: 0 }}>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={createOwnReference}>
          📷 上传自己的参考照片
        </button>
        <div className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>
          或从下方选择一张喜欢的模板
        </div>
      </div>
      <div className="chips">
        <div className={`chip ${cat === '' ? 'active' : ''}`} onClick={() => pickCategory('')}>全部</div>
        {categories.map((c) => (
          <div key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => pickCategory(c)}>{c}</div>
        ))}
      </div>
      <div className="user-content">
        <h2>选择你喜欢的照片</h2>
        {loading ? (
          <Loading text="加载参考照片…" />
        ) : refs.length === 0 ? (
          <div className="empty">暂无参考照片</div>
        ) : (
          <div className="gallery" style={{ padding: 0 }}>
            {refs.map((r) => (
              <div key={r.id} className="gallery-card" onClick={() => setSelected(r)}>
                <Img src={r.url} alt={r.name} />
                <div className="meta">
                  <span className="name">{r.name}</span>
                  <span className="gen">生成同款</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <Img src={selected.url} alt={selected.name} style={{ borderRadius: 10, width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
          <div style={{ marginTop: 14, color: '#9aa3b2', fontSize: 13 }}>分类：{selected.category}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelected(null)}>重新选择</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy} onClick={generate}>
              {busy ? '创建中…' : '使用这张 · 开始生成'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
