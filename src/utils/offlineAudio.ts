// ==========================================
// 音声ファイルの一括ダウンロード（オフライン対応）
// Service Workerのランタイムキャッシュ(audio-cache)に
// すべての音声ファイルを事前に取り込む
// ==========================================

import { words } from "../data/words";

const CONCURRENCY = 8;

export interface DownloadProgress {
  done: number;
  total: number;
}

// 全単語の発音・例文音声のURL一覧
const getAllAudioUrls = (): string[] => {
  const urls: string[] = [];
  for (const w of words) {
    urls.push(`/audio/${w.id}.mp3`);
    urls.push(`/audio/${w.id}-ex.mp3`);
  }
  return urls;
};

export const getAudioDownloadTotal = (): number => getAllAudioUrls().length;

// 音声を一括ダウンロードしてキャッシュに保存する
export const downloadAllAudio = async (
  onProgress: (progress: DownloadProgress) => void
): Promise<{ succeeded: number; failed: number }> => {
  const urls = getAllAudioUrls();
  let done = 0;
  let succeeded = 0;
  let failed = 0;

  const queue = [...urls];
  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      try {
        const res = await fetch(url, { cache: "default" });
        if (res.ok) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
      done++;
      onProgress({ done, total: urls.length });
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  return { succeeded, failed };
};

// キャッシュ済みの音声ファイル数を確認する
export const getCachedAudioCount = async (): Promise<number> => {
  if (!("caches" in window)) return 0;
  try {
    const cache = await caches.open("audio-cache");
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
};

// 音声キャッシュを削除する
export const clearAudioCache = async (): Promise<void> => {
  if (!("caches" in window)) return;
  await caches.delete("audio-cache");
};
