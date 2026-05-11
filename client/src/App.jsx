import { useCallback, useRef } from 'react';
import UploadZone from './components/UploadZone';
import ActionBar from './components/ActionBar';
import FileCard from './components/FileCard';
import FileListPanel from './components/FileListPanel';
import { ToastContainer, addToast } from './components/Toast';
import { useUpload } from './uploadHook';

export default function App() {
  const fileInputRef = useRef();
  const { files, stats, addFile, removeFile, startAll, pauseAll, resumeAll, pauseFile, resumeFile, clearAll, retryFile } = useUpload();

  const handleUpload = useCallback(() => {
    if (stats.uploading > 0) {
      pauseAll();
      addToast('已全部暂停', 'info');
    } else if (stats.paused > 0) {
      resumeAll();
      addToast('继续上传', 'info');
    } else if (stats.idle > 0) {
      startAll();
    }
  }, [stats, pauseAll, resumeAll, startAll]);

  const fileList = Object.values(files).reverse();

  return (
    <>
      <div className="page-header">
        <h1>文件上传中心</h1>
        <p>大文件分片上传 · 断点续传 · 秒传验证 (MD5)</p>
      </div>

      <div className="main-layout">
        <div className="upload-section">
          <UploadZone onFilesSelected={(files) => files.forEach(f => addFile(f))} />

          <ActionBar
            stats={stats}
            onSelect={() => fileInputRef.current?.click()}
            onUpload={handleUpload}
            onClear={() => {
              clearAll();
              addToast('已清空列表', 'info');
            }}
          />

          <input
            ref={fileInputRef}
            id="file-input-hidden"
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              const files = Array.from(e.target.files);
              files.forEach(f => addFile(f));
              e.target.value = '';
            }}
          />

          <div className="file-list">
            {fileList.map(task => (
              <FileCard
                key={task.id}
                task={task}
                onRemove={removeFile}
                onRetry={retryFile}
                onPause={pauseFile}
                onResume={resumeFile}
              />
            ))}
          </div>
        </div>

        <div className="server-section">
          <FileListPanel />
        </div>
      </div>

      <ToastContainer />
    </>
  );
}
