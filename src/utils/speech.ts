// ==========================================
// Web Speech API ユーティリティ
// 英語の発音を担当します
// ==========================================

// Android Chrome等では初回のgetVoices()が空配列を返すことがあるため、
// voiceschangedイベントを待ってから声を選ぶようにする（音声取得のキャッシュ）
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;

const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (voicesReadyPromise) return voicesReadyPromise;

  voicesReadyPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    // voiceschangedが発火しない端末もあるため、タイムアウトで諦めて進める
    setTimeout(finish, 500);
  });

  return voicesReadyPromise;
};

// 英語テキストを音声で読み上げる
export const speakEnglish = async (text: string, rate = 0.9): Promise<void> => {
  if (!window.speechSynthesis) return;

  const voices = await loadVoices();

  // 前の発音を止める
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // 英語音声を優先して選択する
  const englishVoice = voices.find(
    (v) => v.lang.startsWith("en") && v.localService
  ) || voices.find((v) => v.lang.startsWith("en"));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
};

// 現在再生中の事前録音オーディオ（多重再生防止用）
let currentAudio: HTMLAudioElement | null = null;

const playAudioFile = (url: string, onFail: () => void): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const audio = new Audio(url);
  currentAudio = audio;
  audio.addEventListener("error", onFail, { once: true });
  audio.play().catch(onFail);
};

// 単語の発音を再生する（事前生成した音声ファイルを優先し、失敗時はTTSにフォールバック）
export const playWordAudio = (wordId: string, fallbackText: string): void => {
  playAudioFile(`/audio/${wordId}.mp3`, () => {
    void speakEnglish(fallbackText);
  });
};

// 例文の読み上げを再生する（事前生成した音声ファイルを優先し、失敗時はTTSにフォールバック）
export const playExampleAudio = (wordId: string, fallbackText: string): void => {
  playAudioFile(`/audio/${wordId}-ex.mp3`, () => {
    void speakEnglish(fallbackText, 0.85);
  });
};

// 正解音（明るい上昇音）
export const playCorrectSound = (): void => {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.15);
    });
  } catch {
    // Web Audio API非対応環境では無視
  }
};

// 不正解音（低い下降音）
export const playWrongSound = (): void => {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Web Audio API非対応環境では無視
  }
};

// 音声が利用できるかチェックする
export const isSpeechAvailable = (): boolean => {
  return typeof window !== "undefined" && "speechSynthesis" in window;
};

// 再生中の音声を止める
export const stopSpeech = (): void => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
};
