export const CONFIG = {
  CHUNK_SIZE: 2 * 1024 * 1024,
  LARGE_FILE_THRESHOLD: 2 * 1024 * 1024,
  MAX_CONCURRENT_FILES: 3,
  MAX_CONCURRENT_CHUNKS: 3,
  MAX_RETRIES: 3,
  UPLOAD_URL: '/upload',
  HASH_URL: '/check',
  FILES_URL: '/files',
  DELETE_URL: '/files/delete',
};

export const DEMO_MODE = false;
