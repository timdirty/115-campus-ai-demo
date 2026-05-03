import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Image as ImageIcon, List, MessageSquarePlus, Send, Trash2, X } from 'lucide-react';

type Issue = {
  id: string;
  text: string;
  imageDataUrl?: string;
  createdAt: number;
};

function loadIssues(key: string): Issue[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

function saveIssues(key: string, issues: Issue[]) {
  try { localStorage.setItem(key, JSON.stringify(issues)); } catch {}
}

function fmt(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function IssueReporter({
  storageKey,
  accentColor = '#6366f1',
}: {
  storageKey: string;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'form' | 'list'>('form');
  const [text, setText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>();
  const [issues, setIssues] = useState<Issue[]>(() => loadIssues(storageKey));
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { alert('圖片請選 1.5MB 以內'); return; }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => { setImageDataUrl(undefined); if (fileRef.current) fileRef.current.value = ''; };

  const handleSubmit = () => {
    if (!text.trim()) return;
    const next: Issue[] = [{ id: Date.now().toString(), text: text.trim(), imageDataUrl, createdAt: Date.now() }, ...issues];
    setIssues(next);
    saveIssues(storageKey, next);
    setText('');
    clearImage();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  const handleDelete = (id: string) => {
    const next = issues.filter(i => i.id !== id);
    setIssues(next);
    saveIssues(storageKey, next);
  };

  const toggle = () => { setOpen(o => !o); setView('form'); };

  return (
    <>
      <button
        onClick={toggle}
        title="回報問題"
        style={{
          position: 'fixed', bottom: 20, left: 20, zIndex: 9000,
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: accentColor, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', color: 'white',
        }}
      >
        {open ? <X size={22} /> : <MessageSquarePlus size={22} />}
        {!open && issues.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            backgroundColor: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700,
            borderRadius: '50%', width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {issues.length > 9 ? '9+' : issues.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', bottom: 76, left: 20, zIndex: 9000,
              width: 320, maxHeight: '70vh',
              backgroundColor: 'white', borderRadius: 16,
              boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {view === 'list' && (
                  <button onClick={() => setView('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 2 }}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                  {view === 'form' ? '回報問題' : `問題清單 (${issues.length})`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {view === 'form' && issues.length > 0 && (
                  <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <List size={15} /> 清單
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {view === 'form' ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="描述你發現的問題或想改進的地方…"
                  rows={4}
                  style={{
                    width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: '8px 10px', fontSize: 13, color: '#1e293b',
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />

                {imageDataUrl ? (
                  <div style={{ position: 'relative' }}>
                    <img src={imageDataUrl} alt="附圖" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 140 }} />
                    <button onClick={clearImage} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                    <ImageIcon size={15} /> 附上截圖（選填）
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />

                <button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  style={{
                    backgroundColor: text.trim() ? accentColor : '#e2e8f0',
                    color: text.trim() ? 'white' : '#94a3b8',
                    border: 'none', borderRadius: 8, padding: '9px 16px',
                    cursor: text.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 14, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {submitted ? '✓ 已送出！' : <><Send size={14} /> 送出回報</>}
                </button>

                {issues.length > 0 && (
                  <button onClick={() => setView('list')} style={{ color: '#64748b', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                    查看所有 {issues.length} 筆回報 →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {issues.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>還沒有回報</div>
                ) : issues.map(issue => (
                  <div key={issue.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.5, flex: 1 }}>{issue.text}</p>
                      <button onClick={() => handleDelete(issue.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2, flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {issue.imageDataUrl && (
                      <img src={issue.imageDataUrl} alt="" style={{ width: '100%', borderRadius: 6, marginTop: 8, objectFit: 'cover', maxHeight: 100 }} />
                    )}
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94a3b8' }}>{fmt(issue.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
