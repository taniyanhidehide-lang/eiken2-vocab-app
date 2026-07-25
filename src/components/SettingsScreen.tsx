import { useState, useEffect } from "react";
import type { StudyRecord } from "../types";
import { downloadAllAudio, getAudioDownloadTotal, getCachedAudioCount, clearAudioCache } from "../utils/offlineAudio";

interface Props {
  record: StudyRecord;
  onBack: () => void;
  onSetTestDate: (date: string) => void;
  onSetClearTargetDate: (date: string) => void;
  onToggleAudioMode: () => void;
  onSetSessionLength: (n: number) => void;
  onSetDailyNewTarget: (n: number) => void;
  onSetDailyClearTarget: (n: number) => void;
}

const SESSION_LENGTHS = [5, 10, 15, 20, 25, 30] as const;

export const SettingsScreen = ({
  record, onBack, onSetTestDate, onSetClearTargetDate,
  onToggleAudioMode, onSetSessionLength,
  onSetDailyNewTarget, onSetDailyClearTarget,
}: Props) => {
  const [editingTestDate, setEditingTestDate] = useState(false);
  const [editingClearDate, setEditingClearDate] = useState(false);
  const [copied, setCopied] = useState(false);

  const [audioTotal] = useState(() => getAudioDownloadTotal());
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadResult, setDownloadResult] = useState<string | null>(null);

  useEffect(() => {
    getCachedAudioCount().then(setCachedCount);
  }, []);

  const handleDownloadAudio = async () => {
    setDownloading(true);
    setDownloadResult(null);
    setDownloadProgress(0);
    const { succeeded, failed } = await downloadAllAudio(({ done, total }) => {
      setDownloadProgress(Math.round((done / total) * 100));
    });
    setDownloading(false);
    setDownloadResult(failed > 0 ? `完了：${succeeded}件成功、${failed}件失敗` : `完了：${succeeded}件すべて保存しました`);
    getCachedAudioCount().then(setCachedCount);
  };

  const handleClearAudioCache = async () => {
    await clearAudioCache();
    setDownloadResult(null);
    getCachedAudioCount().then(setCachedCount);
  };

  const shareUrl = `${window.location.origin}/parent/${record.shareCode}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-header">
        <button className="btn-back-settings" onClick={onBack}>← 戻る</button>
        <h2 className="settings-title">設定</h2>
      </div>

      {/* ===== 英検テスト日 ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">英検テスト日</h3>
        {!editingTestDate ? (
          <div className="setting-row">
            <span className="setting-value">{record.testDate ? record.testDate.replace(/-/g, "/") : "未設定"}</span>
            <button className="btn-setting-edit" onClick={() => setEditingTestDate(true)}>
              {record.testDate ? "変更" : "設定する"}
            </button>
          </div>
        ) : (
          <div className="date-input-area">
            <label className="date-label">英検テスト日を選んでください</label>
            <input
              type="date" className="date-input"
              defaultValue={record.testDate || ""}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => { onSetTestDate(e.target.value); setEditingTestDate(false); }}
            />
            <button className="btn-text-small" onClick={() => setEditingTestDate(false)}>キャンセル</button>
          </div>
        )}
      </div>

      {/* ===== 全クリア目標日 ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">全クリア目標日</h3>
        {!editingClearDate ? (
          <div className="setting-row">
            <span className="setting-value">{record.clearTargetDate ? record.clearTargetDate.replace(/-/g, "/") : "未設定"}</span>
            <button className="btn-setting-edit" onClick={() => setEditingClearDate(true)}>
              {record.clearTargetDate ? "変更" : "設定する"}
            </button>
          </div>
        ) : (
          <div className="date-input-area">
            <label className="date-label">全単語クリア目標日を選んでください</label>
            <input
              type="date" className="date-input"
              defaultValue={record.clearTargetDate || ""}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => { onSetClearTargetDate(e.target.value); setEditingClearDate(false); }}
            />
            <button className="btn-text-small" onClick={() => setEditingClearDate(false)}>キャンセル</button>
          </div>
        )}
      </div>

      {/* ===== 音声のみモード ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">音声のみモード</h3>
        <div className="audio-mode-toggle" onClick={onToggleAudioMode} style={{ margin: 0 }}>
          <div className="audio-mode-info">
            <span className="audio-mode-icon">🔊</span>
            <div>
              <p className="audio-mode-title">音声のみモード</p>
              <p className="audio-mode-desc">
                {record.audioOnlyMode ? "ON：英単語を非表示にして音声だけで出題" : "OFF：英単語を表示して出題（通常）"}
              </p>
            </div>
          </div>
          <div className={`toggle-switch ${record.audioOnlyMode ? "on" : ""}`}>
            <div className="toggle-knob" />
          </div>
        </div>
      </div>

      {/* ===== 音声の一括ダウンロード ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">音声の一括ダウンロード</h3>
        <p className="setting-desc">
          電車の中など電波が弱い場所でも発音がすぐ再生できるように、あらかじめ全単語の音声をダウンロードしておけます。
          {cachedCount !== null && ` （現在 ${cachedCount} / ${audioTotal} 件保存済み）`}
        </p>
        {downloading ? (
          <div className="setting-row">
            <span className="setting-value">ダウンロード中… {downloadProgress}%</span>
          </div>
        ) : (
          <div className="setting-row">
            <button className="btn-setting-edit" onClick={handleDownloadAudio}>
              一括ダウンロード
            </button>
            {cachedCount !== null && cachedCount > 0 && (
              <button className="btn-text-small" onClick={handleClearAudioCache}>
                削除
              </button>
            )}
          </div>
        )}
        {downloadResult && <p className="share-note">{downloadResult}</p>}
      </div>

      {/* ===== 1セッションの問題数 ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">1セッションの問題数</h3>
        <div className="session-length-grid">
          {SESSION_LENGTHS.map(n => (
            <button
              key={n}
              className={`session-btn ${record.sessionLength === n ? "active" : ""}`}
              onClick={() => onSetSessionLength(n)}
            >
              {n}問
            </button>
          ))}
        </div>
      </div>

      {/* ===== 1日の目標語数 ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">1日の目標語数</h3>
        {record.clearTargetDate && (
          <p className="setting-desc">
            全クリア目標日までの残り日数とレベルから自動計算した目安です。必要に応じて手動でも調整できます。
          </p>
        )}
        <TargetStepper label="新履修目標" value={record.dailyNewTarget} min={5} max={60} step={5} onChange={onSetDailyNewTarget} />
        <TargetStepper label="クリア目標"  value={record.dailyClearTarget} min={5} max={60} step={5} onChange={onSetDailyClearTarget} />
      </div>

      {/* ===== 保護者共有URL ===== */}
      <div className="setting-section">
        <h3 className="setting-section-title">📤 保護者への共有</h3>
        <p className="setting-desc">このURLを保護者に伝えると、学習進捗を確認できます。</p>
        <div className="share-url-box">
          <span className="share-url-text">{shareUrl}</span>
          <button className="btn-copy" onClick={handleCopy}>
            {copied ? "✅ コピー済" : "📋 コピー"}
          </button>
        </div>
        <p className="share-note">※ URLは変わりません。一度共有すれば毎回送る必要はありません。</p>
        <p className="share-note">※ 学習完了後に自動でデータが送信されます。</p>
      </div>
    </div>
  );
};

const TargetStepper = ({
  label, value, min, max, step, onChange,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) => (
  <div className="target-stepper">
    <span className="target-stepper-label">{label}</span>
    <div className="target-stepper-controls">
      <button className="stepper-btn" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</button>
      <span className="stepper-value">{value}語</span>
      <button className="stepper-btn" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>＋</button>
    </div>
  </div>
);
