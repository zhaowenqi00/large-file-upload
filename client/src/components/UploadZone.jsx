import { useState, useRef } from 'react';

export default function UploadZone({ onFilesSelected }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesSelected(files);
  };

  return (
    <div
      className={`upload-zone${dragging ? ' drag-over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="upload-zone-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <h3>拖拽文件到此处，或点击选择</h3>
      <p>支持任意格式，单次可上传多个文件</p>
      <p className="hint">大文件（&gt; 2 MB）自动启用分片上传</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files);
          if (files.length) onFilesSelected(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
