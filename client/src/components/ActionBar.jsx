export default function ActionBar({ stats, onSelect, onUpload, onClear }) {
  const { total, waiting, uploading, paused, done, error } = stats;
  const hasFiles = total > 0;

  let uploadLabel, uploadClass;
  if (uploading > 0) {
    uploadLabel = '暂停全部';
    uploadClass = 'btn-secondary';
  } else if (paused > 0) {
    uploadLabel = '继续全部';
    uploadClass = 'btn-success';
  } else {
    uploadLabel = '开始上传';
    uploadClass = 'btn-primary';
  }

  return (
    <div className="action-bar">
      <div className="stats">
        待上传 <strong>{waiting}</strong> 个文件
        {uploading > 0 && <> &nbsp;&middot;&nbsp; 上传中 <strong>{uploading}</strong></>}
        {done > 0 && <> &nbsp;&middot;&nbsp; <span style={{ color: 'var(--success)' }}>完成 {done}</span></>}
        {error > 0 && <> &nbsp;&middot;&nbsp; <span style={{ color: 'var(--error)' }}>失败 {error}</span></>}
      </div>
      <div className="action-buttons">
        <button className="btn btn-secondary" onClick={onSelect}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          选择文件
        </button>
        <button
          className={`btn ${uploadClass}`}
          disabled={waiting === 0 && uploading === 0 && paused === 0}
          onClick={onUpload}
        >
          {uploading > 0 ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
          {uploadLabel}
        </button>
        <button
          className="btn btn-danger"
          style={{ display: hasFiles ? 'inline-flex' : 'none' }}
          onClick={onClear}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          清空列表
        </button>
      </div>
    </div>
  );
}
