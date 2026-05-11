import { useState, useEffect } from 'react';
import ServerFileCard from './ServerFileCard';
import { CONFIG } from '../config';
import { addToast } from './Toast';

export default function FileListPanel() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingHash, setDeletingHash] = useState(null);

  const fetchFiles = async () => {
    try {
      const resp = await fetch(CONFIG.FILES_URL);
      const data = await resp.json();
      setFiles(data.files || []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (hash, name) => {
    setDeletingHash(hash);
    try {
      const resp = await fetch(CONFIG.DELETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, name }),
      });
      const data = await resp.json();
      if (data.success) {
        setFiles(prev => prev.filter(f => f.hash !== hash));
        addToast(`已删除 ${name}`, 'success');
      } else {
        addToast(data.error || '删除失败', 'error');
      }
    } catch {
      addToast('删除请求失败', 'error');
    } finally {
      setDeletingHash(null);
    }
  };

  return (
    <div className="server-panel">
      <div className="server-panel-header">
        <h2>已上传文件</h2>
        <button className="icon-btn refresh" onClick={fetchFiles} title="刷新">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <div className="server-file-list">
        {loading ? (
          <div className="server-empty">
            <div className="loading-dots">
              <span/><span/><span/>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="server-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p>暂无上传文件</p>
          </div>
        ) : (
          files.map(file => (
            <ServerFileCard
              key={file.hash}
              file={file}
              onDelete={handleDelete}
              deleting={deletingHash === file.hash}
            />
          ))
        )}
      </div>
    </div>
  );
}
