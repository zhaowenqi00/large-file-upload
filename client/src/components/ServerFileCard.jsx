import { formatBytes } from '../utils';

export default function ServerFileCard({ file, onDelete, deleting }) {
  const date = new Date(file.uploadedAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const ext = file.name.split('.').pop().toLowerCase();
  const iconColor = {
    zip: '#f59e0b', pdf: '#ef4444', png: '#22c55e', jpg: '#22c55e', jpeg: '#22c55e',
    mp4: '#8b5cf6', mp3: '#06b6d4', doc: '#3b82f6', docx: '#3b82f6',
    xls: '#16a34a', xlsx: '#16a34a', txt: '#64748b',
  }[ext] || '#94a3b8';

  return (
    <div className="server-file-card">
      <div className="server-file-icon" style={{ background: `${iconColor}18`, borderColor: `${iconColor}30` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className="server-file-info">
        <a className="server-file-name" href={file.url} target="_blank" rel="noreferrer" title={file.name}>
          {file.name}
        </a>
        <div className="server-file-meta">
          <span>{formatBytes(file.size)}</span>
          <span className="dot">·</span>
          <span>{dateStr}</span>
        </div>
      </div>
      <div className="server-file-actions">
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          className="icon-btn download"
          title="下载"
          onClick={e => e.stopPropagation()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
        <button
          className="icon-btn remove"
          title="删除"
          disabled={deleting}
          onClick={() => onDelete(file.hash, file.name)}
        >
          {deleting ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
              <line x1="12" y1="2" x2="12" y2="6"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
              <line x1="2" y1="12" x2="6" y2="12"/>
              <line x1="18" y1="12" x2="22" y2="12"/>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
