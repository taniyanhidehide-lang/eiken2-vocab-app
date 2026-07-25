import { useEffect, useState } from "react";
import type { ParentData, ParentComment } from "../utils/sync";
import { fetchParentData, fetchComment, sendComment } from "../utils/sync";

interface Props {
  shareCode: string;
}

const LEVEL_COLORS: Record<string, string> = {
  入門: "#22c55e",
  初級: "#3b82f6",
  中級: "#f59e0b",
  上級: "#ef4444",
  最上級: "#a855f7",
};

// お子さんへのコメント送信フォーム
const CommentForm = ({ shareCode }: { shareCode: string }) => {
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState(false);
  const [lastComment, setLastComment] = useState<ParentComment | null>(null);

  useEffect(() => {
    fetchComment(shareCode).then(setLastComment);
  }, [shareCode]);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setSending(true);
    const sentAt = new Date().toISOString();
    await sendComment(shareCode, text);
    setSending(false);
    setCommentText("");
    setSentMsg(true);
    setLastComment({ text, sentAt });
    setTimeout(() => setSentMsg(false), 3000);
  };

  return (
    <div className="parent-comment-form">
      <label className="parent-comment-form-label">💬 お子さんへのコメント</label>
      <textarea
        className="parent-comment-textarea"
        placeholder="がんばってるね！応援メッセージを送れます"
        value={commentText}
        onChange={e => setCommentText(e.target.value)}
        maxLength={200}
        rows={3}
      />
      <div className="parent-comment-form-footer">
        <span className="parent-comment-form-count">{commentText.length}/200</span>
        <button
          className="parent-comment-form-send"
          disabled={!commentText.trim() || sending}
          onClick={handleSendComment}
        >
          {sending ? "送信中..." : "送信する"}
        </button>
      </div>
      {sentMsg && <p className="parent-comment-form-sent">✅ 送信しました！次回ホーム画面に表示されます</p>}

      {lastComment && (
        <div className="parent-comment-status">
          <p className="parent-comment-status-label">📨 送信済みメッセージ</p>
          <p className="parent-comment-status-text">「{lastComment.text}」</p>
          {lastComment.reaction ? (
            <p className="parent-comment-status-reaction">
              お子さんの反応：<span className="parent-comment-status-reaction-emoji">{lastComment.reaction}</span>
            </p>
          ) : (
            <p className="parent-comment-status-reaction pending">まだ反応はありません</p>
          )}
        </div>
      )}
    </div>
  );
};

export const ParentView = ({ shareCode }: Props) => {
  const [data, setData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchParentData(shareCode).then(d => {
      if (d) {
        setData(d);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [shareCode]);

  const formatUpdated = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="parent-view parent-center">
        <div className="parent-big-icon">⏳</div>
        <p className="parent-loading-text">読み込み中...</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="parent-view">
        <div className="parent-center" style={{ paddingBottom: 8 }}>
          <div className="parent-big-icon">📭</div>
          <h2 className="parent-notfound-title">データがまだありません</h2>
          <p className="parent-notfound-desc">
            コード「{shareCode}」の学習データは見つかりませんでした。<br />
            学習を完了すると自動的に表示されます。
          </p>
        </div>
        <CommentForm shareCode={shareCode} />
      </div>
    );
  }

  const totalCleared = data.levels.reduce((s, l) => s + l.cleared, 0);
  const totalWords   = data.levels.reduce((s, l) => s + l.total, 0);
  const overallPct   = totalWords > 0 ? Math.round((totalCleared / totalWords) * 100) : 0;

  return (
    <div className="parent-view">
      {/* ヘッダー */}
      <div className="parent-header">
        <h1 className="parent-title">📚 英検2級</h1>
        <p className="parent-subtitle">学習進捗レポート</p>
        <p className="parent-updated">最終更新：{formatUpdated(data.updatedAt)}</p>
      </div>

      <CommentForm shareCode={shareCode} />

      {/* 新しく獲得した称号 */}
      {data.newAchievements && data.newAchievements.length > 0 && (
        <div className="parent-achievement-banner">
          <p className="parent-achievement-banner-title">🎉 新しい称号を獲得しました！</p>
          <div className="parent-achievement-banner-list">
            {data.newAchievements.map((a, i) => (
              <span key={i} className="parent-achievement-banner-item">
                <span className="parent-achievement-banner-emoji">{a.emoji}</span>
                {a.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 今日の学習 */}
      {data.studyDate && (
        <div className="parent-today">
          <p className="parent-today-date">{data.studyDate.replace(/-/g, "/")} の学習</p>
          <div className="parent-today-cards">
            <div className="parent-today-card new">
              <span className="parent-today-num">{data.todayNew ?? 0}</span>
              <span className="parent-today-unit">語</span>
              <span className="parent-today-label">今日の新履修</span>
            </div>
            <div className="parent-today-card cleared">
              <span className="parent-today-num">{data.todayCleared ?? 0}</span>
              <span className="parent-today-unit">語</span>
              <span className="parent-today-label">今日のクリア</span>
            </div>
          </div>
        </div>
      )}

      {/* 全体サマリー */}
      <div className="parent-summary">
        <div className="parent-overall-circle">
          <span className="parent-overall-pct">{overallPct}%</span>
          <span className="parent-overall-sub">全体達成率</span>
        </div>
        <div className="parent-summary-detail">
          <div className="parent-summary-row">
            <span className="parent-summary-label">クリア語数</span>
            <span className="parent-summary-value">{totalCleared} / {totalWords} 語</span>
          </div>
          <div className="parent-summary-row">
            <span className="parent-summary-label">現在のレベル</span>
            <span className="parent-summary-value">{data.currentLevel}</span>
          </div>
          <div className="parent-summary-row">
            <span className="parent-summary-label">連続学習</span>
            <span className="parent-summary-value">{data.streak} 日</span>
          </div>
          {data.lastStudied && (
            <div className="parent-summary-row">
              <span className="parent-summary-label">最終学習日</span>
              <span className="parent-summary-value">{data.lastStudied.replace(/-/g, "/")}</span>
            </div>
          )}
        </div>
      </div>

      {/* レベル別 */}
      <div className="parent-section">
        <h2 className="parent-section-title">レベル別クリア状況</h2>
        <div className="parent-levels">
          {data.levels.map(level => {
            const isCurrent = level.name === data.currentLevel;
            const color = LEVEL_COLORS[level.name] ?? "#6b7280";
            return (
              <div key={level.name} className={`parent-level-row${isCurrent ? " current" : ""}`}>
                <div className="parent-level-header">
                  <span className="parent-level-name" style={{ color }}>
                    {isCurrent ? "★ " : ""}{level.name}
                  </span>
                  <span className="parent-level-pct" style={{ color }}>{level.pct}%</span>
                </div>
                <div className="parent-level-bar-wrap">
                  <div
                    className="parent-level-bar-fill"
                    style={{ width: `${level.pct}%`, background: color }}
                  />
                </div>
                <span className="parent-level-count">{level.cleared} / {level.total} 語クリア</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="parent-footer-note">コード：{shareCode}</p>
    </div>
  );
};
