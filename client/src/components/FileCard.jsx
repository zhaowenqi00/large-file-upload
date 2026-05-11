import { formatBytes, formatSpeed } from '../utils';

const TAG_MAP = {
  idle: ['idle', '等待上传'],
  hashing: ['hashing', '计算 MD5'],
  uploading: ['uploading', '上传中'],
  paused: ['paused', '已暂停'],
  done: ['done', '上传完成'],
  error: ['error', '上传失败'],
};

export default function FileCard({ task, onRemove, onRetry, onPause, onResume }) {
  const { id, file, state, progress, speed, uploadedBytes, hashProgress, _magicDone } = task;
  const [cls, label] = TAG_MAP[state] || ['idle', '未知'];

  const showProgress = ['uploading', 'done', 'paused', 'error'].includes(state);
  const pct = Math.round(progress * 100);

  const getCardClass = () => {
    let c = 'file-card';
    if (state === 'uploading' || state === 'hashing') c += ' uploading';
    else if (state === 'done') c += ' done';
    else if (state === 'error') c += ' error';
    else if (state === 'paused') c += ' paused';
    return c;
  };

  return (
    <div className={getCardClass()}>
      <div className="file-card-header">
        <div className="file-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className="file-info">
          <div className="file-name">{file.name}</div>
          <div className="file-meta">
            <span>{formatBytes(file.size)}</span>
            <span className={`status-tag ${cls}`}>
              {state === 'hashing'
                ? `计算中 ${Math.round(hashProgress * 100)}%`
                : state === 'done' && _magicDone
                ? '秒传成功'
                : label}
            </span>
          </div>
        </div>
        <div className="file-actions">
          {(state === 'uploading' || state === 'hashing') && (
            <button className="icon-btn pause" title="暂停" onClick={() => onPause(id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>
          )}
          {state === 'paused' && (
            <button className="icon-btn resume" title="继续" onClick={() => onResume(id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
          )}
          {state === 'error' && (
            <button className="icon-btn retry" title="重试" onClick={() => onRetry(id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          )}
          {state !== 'uploading' && state !== 'hashing' && (
            <button className="icon-btn remove" title="移除" onClick={() => onRemove(id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="progress-area">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-info">
            <span>{formatBytes(uploadedBytes)} / {formatBytes(file.size)} ({pct}%)</span>
            <span className="speed">{speed > 0 ? formatSpeed(speed) : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}
