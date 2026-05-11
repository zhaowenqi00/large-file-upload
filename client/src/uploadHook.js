import { useReducer, useCallback, useRef, useEffect } from 'react';
import { CONFIG, DEMO_MODE } from './config';
import { uuid } from './utils';
import { calculateMD5 } from './md5';

function taskReducer(state, action) {
  switch (action.type) {
    case 'ADD_FILE':
      return {
        ...state,
        files: { ...state.files, [action.id]: action.file },
        queue: [...state.queue, action.id],
        stats: computeStats({ ...state.files, [action.id]: action.file }),
      };
    case 'UPDATE_FILE':
      return {
        ...state,
        files: { ...state.files, [action.id]: { ...state.files[action.id], ...action.updates } },
        stats: computeStats({ ...state.files, [action.id]: { ...state.files[action.id], ...action.updates } }),
      };
    case 'REMOVE_FILE': {
      const { [action.id]: _, ...rest } = state.files;
      return {
        ...state,
        files: rest,
        queue: state.queue.filter(id => id !== action.id),
        stats: computeStats(rest),
      };
    }
    case 'CLEAR_FILES':
      return {
        ...state,
        files: {},
        queue: [],
        stats: { total: 0, idle: 0, hashing: 0, uploading: 0, paused: 0, done: 0, error: 0, waiting: 0 },
      };
    case 'SET_STATS':
      return { ...state, stats: action.stats };
    default:
      return state;
  }
}

function computeStats(files) {
  const list = Object.values(files);
  return {
    total: list.length,
    idle: list.filter(f => f.state === 'idle').length,
    hashing: list.filter(f => f.state === 'hashing').length,
    uploading: list.filter(f => f.state === 'uploading').length,
    paused: list.filter(f => f.state === 'paused').length,
    done: list.filter(f => f.state === 'done').length,
    error: list.filter(f => f.state === 'error').length,
    waiting: list.filter(f => f.state === 'idle' || f.state === 'paused').length,
  };
}

export function useUpload() {
  const [state, dispatch] = useReducer(taskReducer, {
    files: {},
    queue: [],
    stats: { total: 0, idle: 0, hashing: 0, uploading: 0, paused: 0, done: 0, error: 0, waiting: 0 },
  });

  const abortControllers = useRef({});
  const activeCount = useRef(0);

  const updateFile = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_FILE', id, updates });
  }, []);

  const _startNext = useCallback(() => {
    const { queue, files } = state;
    while (queue.length > 0 && activeCount.current < CONFIG.MAX_CONCURRENT_FILES) {
      const id = queue[0];
      const task = files[id];
      if (!task) { queue.shift(); continue; }
      if (task.state === 'idle' || task.state === 'paused') {
        dispatch({ type: 'SET_STATS', stats: computeStats(files) });
        break;
      }
      queue.shift();
    }
  }, [state]);

  const addFile = useCallback((file) => {
    if (!file || !file.size) return;
    const id = uuid();
    const newTask = {
      id,
      file,
      state: 'idle',
      progress: 0,
      speed: 0,
      uploadedBytes: 0,
      hashProgress: 0,
      hash: '',
      chunks: [],
      chunkStates: [],
      totalChunks: 0,
      doneChunks: 0,
      _needChunk: file.size > CONFIG.LARGE_FILE_THRESHOLD,
      _magicDone: false,
    };
    dispatch({ type: 'ADD_FILE', id, file: newTask });
    return id;
  }, []);

  const removeFile = useCallback((id) => {
    abortControllers.current[id]?.abort();
    delete abortControllers.current[id];
    dispatch({ type: 'REMOVE_FILE', id });
  }, []);

  const startAll = useCallback(() => {
    const { files, queue } = state;
    while (queue.length > 0 && activeCount.current < CONFIG.MAX_CONCURRENT_FILES) {
      const id = queue[0];
      const task = files[id];
      if (task && (task.state === 'idle' || task.state === 'paused')) {
        queue.shift();
        _startFile(task);
      } else {
        break;
      }
    }
  }, [state, _startNext]);

  const _buildChunks = useCallback((file) => {
    const _needChunk = file.size > CONFIG.LARGE_FILE_THRESHOLD;
    if (_needChunk) {
      const chunks = [];
      for (let i = 0; i < file.size; i += CONFIG.CHUNK_SIZE) {
        chunks.push(file.slice(i, Math.min(i + CONFIG.CHUNK_SIZE, file.size)));
      }
      return chunks;
    }
    return [file];
  }, []);

  const _uploadSingleChunk = useCallback(async (id, chunk, hash, chunkIdx, totalChunks, fileSize, file, ac) => {
    if (DEMO_MODE) {
      const duration = 300 + Math.random() * 600;
      const start = performance.now();
      await new Promise((res) => {
        const tick = () => {
          if (ac.signal.aborted) { res(); return; }
          const elapsed = performance.now() - start;
          const t = Math.min(elapsed / duration, 1);
          updateFile(id, { progress: (t * chunk.size) / fileSize });
          if (t < 1) requestAnimationFrame(tick);
          else res();
        };
        requestAnimationFrame(tick);
      });
      if (ac.signal.aborted) throw new DOMException('aborted', 'AbortError');
      return;
    }

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('hash', hash);
    formData.append('chunkIndex', chunkIdx);
    formData.append('totalChunks', totalChunks);
    formData.append('filename', file.name);
    formData.append('fileSize', fileSize);

    const resp = await fetch(CONFIG.UPLOAD_URL, { method: 'POST', body: formData, signal: ac.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
  }, []);

  const _finalizeUpload = useCallback(async (id, file, hash, totalChunks, ac) => {
    if (!DEMO_MODE) {
      const resp = await fetch(`${CONFIG.UPLOAD_URL}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, name: file.name, totalChunks }),
        signal: ac.signal,
      });
      if (!resp.ok) throw new Error(`Merge failed: ${resp.status}`);
    }
    updateFile(id, { state: 'done', progress: 1 });
    activeCount.current--;
    _startNext();
  }, [updateFile, _startNext]);

  const _uploadChunks = useCallback(async (id, file, hash, chunks, totalChunks, ac, existingChunkStates) => {
    const resolvedChunks = chunks && chunks.length > 0 ? chunks : _buildChunks(file);
    const resolvedTotal = existingChunkStates ? existingChunkStates.length : totalChunks;
    const chunkStates = existingChunkStates
      ? [...existingChunkStates]
      : new Array(resolvedTotal).fill('pending');
    let doneChunks = existingChunkStates
      ? chunkStates.filter(s => s === 'done').length
      : 0;
    let startTime = performance.now();
    let lastTime = startTime;
    let lastBytes = 0;

    // Upload chunks sequentially for reliability
    for (let chunkIdx = 0; chunkIdx < resolvedTotal; chunkIdx++) {
      if (ac.signal.aborted) return;

      // Skip already completed chunks (for resume)
      if (chunkStates[chunkIdx] === 'done') continue;

      chunkStates[chunkIdx] = 'uploading';
      updateFile(id, { chunkStates: [...chunkStates] });

      try {
        const chunk = resolvedChunks[chunkIdx];
        await _uploadSingleChunk(id, chunk, hash, chunkIdx, resolvedTotal, file.size, file, ac);

        chunkStates[chunkIdx] = 'done';
        doneChunks++;
        const uploadedBytes = resolvedChunks.slice(0, chunkIdx).reduce((s, c) => s + c.size, 0) + chunk.size;
        const now = performance.now();
        const elapsed = (now - lastTime) / 1000;
        const speed = elapsed > 0.3 ? (uploadedBytes - lastBytes) / elapsed : 0;
        lastTime = now;
        lastBytes = uploadedBytes;

        updateFile(id, {
          chunkStates: [...chunkStates],
          doneChunks,
          progress: uploadedBytes / file.size,
          uploadedBytes,
          speed,
        });

        // Small delay between chunks to avoid server overload
        if (chunkIdx < resolvedTotal - 1) {
          await new Promise(r => setTimeout(r, 50));
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        console.error('Chunk upload error:', e);
        chunkStates[chunkIdx] = 'error';
        updateFile(id, { state: 'error', chunkStates: [...chunkStates] });
        activeCount.current--;
        _startNext();
        return;
      }
    }

    // All chunks uploaded, finalize
    await _finalizeUpload(id, file, hash, resolvedTotal, ac);
  }, [_buildChunks, _uploadSingleChunk, _finalizeUpload, updateFile, _startNext]);

  const _beginChunkUpload = useCallback((id, file, hash, ac) => {
    const chunks = _buildChunks(file);
    const totalChunks = chunks.length;

    updateFile(id, {
      state: 'uploading',
      chunks,
      chunkStates: new Array(totalChunks).fill('pending'),
      totalChunks,
      doneChunks: 0,
    });

    // Start upload, don't await - let it run in background
    _uploadChunks(id, file, hash, chunks, totalChunks, ac, null).catch((e) => {
      if (e.name === 'AbortError') return;
      console.error('Upload error:', e);
      updateFile(id, { state: 'error' });
      activeCount.current--;
      _startNext();
    });
  }, [_buildChunks, _uploadChunks, updateFile, _startNext]);

  const _checkMagicUpload = useCallback(async (id, file, hash, ac) => {
    if (DEMO_MODE) {
      await new Promise((res, rej) => {
        const t = setTimeout(res, 300);
        ac.signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); });
      });
      if (ac.signal.aborted) return;
      if (file.size < 1024 || file.name.includes('same')) {
        updateFile(id, { state: 'done', progress: 1, _magicDone: true });
        activeCount.current--;
        return;
      }
      _beginChunkUpload(id, file, hash, ac);
      return;
    }
    try {
      const resp = await fetch(`${CONFIG.HASH_URL}?hash=${hash}&size=${file.size}&name=${encodeURIComponent(file.name)}`, { signal: ac.signal });
      const data = await resp.json();
      if (data.exists) {
        console.log('[秒传成功]', file.name);
        updateFile(id, { state: 'done', progress: 1, _magicDone: true });
        activeCount.current--;
        _startNext();
        return;
      }
      console.log('[秒传失败，开始分片上传]', file.name);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('Check error:', e);
    }
    _beginChunkUpload(id, file, hash, ac);
  }, [_beginChunkUpload, updateFile, _startNext]);

  const _startFile = useCallback(async (task) => {
    const { id, file } = task;
    activeCount.current++;

    const ac = new AbortController();
    abortControllers.current[id] = ac;

    updateFile(id, { state: 'hashing', hashProgress: 0 });

    let hash;
    try {
      hash = await calculateMD5(file, (p) => {
        updateFile(id, { hashProgress: p });
      }, ac.signal);
    } catch (e) {
      if (e.name === 'AbortError') return;
      updateFile(id, { state: 'error' });
      activeCount.current--;
      _startNext();
      return;
    }

    if (ac.signal.aborted) return;

    updateFile(id, { hash });
    console.log('[MD5计算完成]', task.file.name, hash);

    await _checkMagicUpload(id, file, hash, ac);
  }, [_checkMagicUpload, updateFile, _startNext]);

  const _resumeChunks = useCallback((task, ac) => {
    const { id, file, hash, chunks, totalChunks, chunkStates } = task;
    _uploadChunks(id, file, hash, chunks, totalChunks, ac, chunkStates);
  }, [_uploadChunks]);

  const _resumeFile = useCallback(async (task) => {
    const { id, file, hash, chunkStates, totalChunks } = task;
    const ac = new AbortController();
    abortControllers.current[id] = ac;
    activeCount.current++;

    if (!hash) {
      updateFile(id, { state: 'hashing', hashProgress: task.hashProgress || 0 });
      try {
        const hash = await calculateMD5(file, (p) => {
          updateFile(id, { hashProgress: p });
        }, ac.signal);
        if (ac.signal.aborted) return;
        updateFile(id, { hash });
        await _checkMagicUpload(id, file, hash, ac);
      } catch (e) {
        if (e.name === 'AbortError') return;
        updateFile(id, { state: 'error' });
        activeCount.current--;
        _startNext();
      }
    } else {
      const allDone = chunkStates && chunkStates.every(s => s === 'done');
      if (allDone) {
        await _finalizeUpload(id, file, hash, totalChunks, ac);
      } else {
        updateFile(id, { state: 'uploading' });
        _resumeChunks(task, ac);
      }
    }
  }, [_checkMagicUpload, _resumeChunks, _finalizeUpload, _startNext, updateFile]);

  const pauseAll = useCallback(() => {
    for (const id of Object.keys(abortControllers.current)) {
      const task = state.files[id];
      if (task && (task.state === 'uploading' || task.state === 'hashing')) {
        abortControllers.current[id].abort();
        updateFile(id, { state: 'paused' });
      }
    }
  }, [state.files, updateFile]);

  const resumeAll = useCallback(() => {
    const { files } = state;
    for (const task of Object.values(files)) {
      if (task.state === 'paused') {
        _resumeFile(task);
      }
    }
  }, [state, _resumeFile]);

  const pauseFile = useCallback((id) => {
    const task = state.files[id];
    if (!task || (task.state !== 'uploading' && task.state !== 'hashing')) return;
    abortControllers.current[id]?.abort();
    updateFile(id, { state: 'paused' });
  }, [state.files, updateFile]);

  const resumeFile = useCallback((id) => {
    const task = state.files[id];
    if (!task || task.state !== 'paused') return;
    _resumeFile(task);
  }, [_resumeFile]);

  const retryFile = useCallback((id) => {
    const task = state.files[id];
    if (!task || task.state !== 'error') return;
    const chunkStates = task.chunkStates.map(s => s === 'error' ? 'pending' : s);
    updateFile(id, { state: 'uploading', chunkStates, retryCount: 0 });
    const ac = new AbortController();
    abortControllers.current[id] = ac;
    activeCount.current++;
    _uploadChunks(id, task.file, task.hash, task.chunks, task.totalChunks, ac, chunkStates);
  }, [state.files, updateFile, _uploadChunks]);

  const clearAll = useCallback(() => {
    for (const ac of Object.values(abortControllers.current)) ac.abort();
    abortControllers.current = {};
    activeCount.current = 0;
    dispatch({ type: 'CLEAR_FILES' });
  }, []);

  useEffect(() => {
    return () => {
      for (const ac of Object.values(abortControllers.current)) ac.abort();
    };
  }, []);

  return {
    files: state.files,
    stats: state.stats,
    addFile,
    removeFile,
    startAll,
    pauseAll,
    resumeAll,
    pauseFile,
    resumeFile,
    clearAll,
    retryFile,
  };
}
