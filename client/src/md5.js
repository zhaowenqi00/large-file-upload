function SimpleMD5() {
  const _s = [
    [7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21]
  ];
  const _K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) _K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

  const _block = new ArrayBuffer(64);
  const _block8 = new Uint8Array(_block);
  const _block32 = new Uint32Array(_block);

  let _h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
  let _len = 0;
  let _off = 0;

  this.append = (bytes) => {
    const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    for (let i = 0; i < b.length; i++) {
      _block8[_off++] = b[i];
      if (_off === 64) { _flush(); _off = 0; }
    }
    _len += b.length;
  };

  this.end = () => {
    const totalBits = _len * 8;

    _block8[_off++] = 0x80;
    if (_off > 56) { _flush(); _off = 0; }
    // Zero-fill remainder of block up to byte 56 (448 bits into the block)
    for (let i = _off; i < 56; i++) _block8[i] = 0;

    // Write 64-bit big-endian length (bits, not bytes) at bytes 56-63
    const low32 = (totalBits & 0xffffffff) >>> 0;
    const high32 = (totalBits / 0x100000000) >>> 0;
    _block32[14] = low32;
    _block32[15] = high32;

    _flush();
    return _toHex(_h[0]) + _toHex(_h[1]) + _toHex(_h[2]) + _toHex(_h[3]);
  };

  function _flush() {
    for (let i = 0; i < 16; i++) {
      _block32[i] = (_block8[i * 4] | (_block8[i * 4 + 1] << 8) |
                    (_block8[i * 4 + 2] << 16) | (_block8[i * 4 + 3] << 24)) >>> 0;
    }
    let A = _h[0], B = _h[1], C = _h[2], D = _h[3];

    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | ((~B) & D); g = i; }
      else if (i < 32) { F = (D & B) | ((~D) & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | (~D)); g = (7 * i) % 16; }
      const shift = _s[Math.floor(i / 16)][i % 4];
      const Xg = _block32[g];
      const temp = ((A + F + _K[i] + Xg) << shift | (A + F + _K[i] + Xg) >>> (32 - shift)) >>> 0;
      A = D; D = C; C = B; B = (B + temp) >>> 0;
    }

    _h[0] = (_h[0] + A) >>> 0;
    _h[1] = (_h[1] + B) >>> 0;
    _h[2] = (_h[2] + C) >>> 0;
    _h[3] = (_h[3] + D) >>> 0;
  }

  function _toHex(n) {
    return ((n >>> 0) & 0xff).toString(16).padStart(2, '0') +
           (((n >>> 0) >> 8) & 0xff).toString(16).padStart(2, '0') +
           (((n >>> 0) >> 16) & 0xff).toString(16).padStart(2, '0') +
           (((n >>> 0) >> 24) & 0xff).toString(16).padStart(2, '0');
  }
}

export function calculateMD5(file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    const reader = new FileReader();
    const chunkSize = 64 * 1024 * 1024;
    let offset = 0;
    const md5 = new SimpleMD5();

    function loadNext() {
      if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    }

    reader.onload = (e) => {
      if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
      md5.append(new Uint8Array(e.target.result));
      offset += e.target.result.byteLength;
      if (offset < file.size) {
        if (onProgress) onProgress(offset / file.size);
        setTimeout(loadNext, 0);
      } else {
        if (onProgress) onProgress(1);
        resolve(md5.end());
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));

    if (signal) signal.addEventListener('abort', () => reader.abort());
    loadNext();
  });
}
