import { useEffect, useState } from "react";
import type { StudyRecord, StudyMode, Level } from "../types";
import { ProgressPanel } from "./ProgressPanel";
import {
  countNeverAnsweredWords,
  countUnclearedWords,
  countPrevDayWrongWords,
  countFourDayReviewWords,
  countTodayNewWords,
  countTodayClearedWords,
  getLevelStats,
  isFinalStageUnlocked,
  countFinalStageInfo,
  computeFinalStageProgress,
  isFinalSubStageUnlocked,
  countFinalStagePrevDayWrongWords,
  countFinalStageFourDayReviewWords,
} from "../utils/quiz";
import { fetchComment, sendCommentReaction } from "../utils/sync";
import type { ParentComment } from "../utils/sync";
import { getCommentReadAt, setCommentReadAt, daysUntil } from "../utils/storage";
import { computeAchievements } from "../utils/achievements";

const COMMENT_REACTIONS = ["❤️", "😄", "👍", "🎉", "😢"];

interface Props {
  record: StudyRecord;
  onStart: (mode: StudyMode) => void;
  onStartByLevel: (level: Level) => void;
  onOpenSettings: () => void;
  onResetLevels: (levels: Level[]) => void;
  savedSessionLabel: string | null;
  onResume: () => void;
  onClearSession: () => void;
}

const LEVEL_ORDER: Level[] = ["入門", "初級", "中級", "上級", "最上級"];

const formatDate = (dateStr: string) => dateStr.replace(/-/g, "/");

const dayColorClass = (days: number) => {
  if (days < 0)  return "days-today";
  if (days <= 6)  return "days-critical";
  if (days <= 13) return "days-warning";
  if (days <= 29) return "days-caution";
  return "days-safe";
};

// 1日の進捗バーカード
const DailyProgressCard = ({
  label, value, target,
}: { label: string; value: number; target: number }) => {
  const isGoalMet = value >= target;
  const isOver200 = value > target * 2;
  const isOver500 = value > target * 5;

  // 200%超えたらバーのスケールを500%に拡張
  const MAX_SCALE = isOver200 ? 5.0 : 2.0;
  const fillPct = Math.min(value / (target * MAX_SCALE), 1) * 100;
  const goalMarkerPct = (1 / MAX_SCALE) * 100;

  const fillClass = isOver500 ? "over500" : isGoalMet ? "goal-met" : "";

  return (
    <div className="daily-card">
      <div className="daily-card-header">
        <span className="daily-card-label">{label}</span>
        <div className="daily-card-right">
          {isGoalMet && <span className="goal-clear-badge">目標クリア</span>}
          <span className={`daily-card-value ${fillClass}`}>
            {value}<span className="daily-card-unit">語</span>
            <span className="daily-card-target"> / 目標{target}語</span>
            <span className="daily-card-pct">（{Math.round((value / target) * 100)}%）</span>
          </span>
        </div>
      </div>
      <div className="daily-bar-wrap">
        <div className={`daily-bar-fill ${fillClass}`} style={{ width: `${fillPct}%` }} />
        <div className="daily-bar-goal-mark" style={{ left: `${goalMarkerPct}%` }} />
      </div>
    </div>
  );
};

const LEVEL_COLORS: Record<Level, string> = {
  入門: "#22c55e", 初級: "#3b82f6", 中級: "#f59e0b", 上級: "#ef4444", 最上級: "#a855f7",
};

export const HomeScreen = ({ record, onStart, onStartByLevel, onOpenSettings, onResetLevels, savedSessionLabel, onResume, onClearSession }: Props) => {
  const todayNewCount    = countTodayNewWords(record);
  const todayClearCount  = countTodayClearedWords(record);
  const neverAnsweredCount = countNeverAnsweredWords(record);
  const unclearedCount   = countUnclearedWords(record);
  const prevDayCount     = countPrevDayWrongWords(record);
  const fourDayCount     = countFourDayReviewWords(record);
  const levelStats       = getLevelStats(record);
  const finalUnlocked    = isFinalStageUnlocked(record);
  const finalInfo        = countFinalStageInfo(record);
  const finalProgress    = computeFinalStageProgress(record);
  const finalPrevDayCount = countFinalStagePrevDayWrongWords(record);
  const finalFourDayCount = countFinalStageFourDayReviewWords(record);
  const achievements      = computeAchievements(record);
  const earnedCount       = achievements.filter((a) => a.earned).length;

  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSelectedLevels, setResetSelectedLevels] = useState<Level[]>([]);
  const [parentComment, setParentComment] = useState<ParentComment | null>(null);

  useEffect(() => {
    if (!record.shareCode) return;
    let cancelled = false;
    fetchComment(record.shareCode).then(comment => {
      if (cancelled || !comment) return;
      if (comment.sentAt > getCommentReadAt()) {
        setParentComment(comment);
      }
    });
    return () => { cancelled = true; };
  }, [record.shareCode]);

  const dismissParentComment = () => {
    if (parentComment) setCommentReadAt(parentComment.sentAt);
    setParentComment(null);
  };

  const [sendingReaction, setSendingReaction] = useState(false);

  const handleSendReaction = async (emoji: string) => {
    if (!parentComment || !record.shareCode || sendingReaction) return;
    setSendingReaction(true);
    await sendCommentReaction(record.shareCode, emoji);
    setParentComment(prev => prev ? { ...prev, reaction: emoji, reactionAt: new Date().toISOString() } : prev);
    setSendingReaction(false);
  };

  const daysToTest  = daysUntil(record.testDate);
  const daysToClear = daysUntil(record.clearTargetDate);
  const bothDatesSet = !!record.testDate && !!record.clearTargetDate;

  const streakMsg =
    record.streakDays >= 7 ? `🔥 ${record.streakDays}日連続！素晴らしい！` :
    record.streakDays >= 3 ? `✨ ${record.streakDays}日連続学習中！` :
    record.streakDays >= 1 ? `${record.streakDays}日連続学習中` : "今日から始めよう！";

  const toggleResetLevel = (level: Level) =>
    setResetSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );

  return (
    <div className="screen home-screen">

      {/* ===== 保護者コメント吹き出し ===== */}
      {parentComment && (
        <div className="parent-comment-bubble">
          <div className="parent-comment-bubble-header">
            <span className="parent-comment-bubble-icon">💬</span>
            <span className="parent-comment-bubble-label">おうちの人から</span>
            <button
              className="parent-comment-bubble-close"
              onClick={dismissParentComment}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
          <p className="parent-comment-bubble-text">{parentComment.text}</p>
          <div className="parent-comment-reactions">
            {COMMENT_REACTIONS.map(emoji => (
              <button
                key={emoji}
                className={`parent-comment-reaction-btn ${parentComment.reaction === emoji ? "selected" : ""}`}
                onClick={() => handleSendReaction(emoji)}
                disabled={sendingReaction}
              >
                {emoji}
              </button>
            ))}
          </div>
          {parentComment.reaction && (
            <p className="parent-comment-reaction-sent">リアクションを送ったよ！</p>
          )}
          <span className="parent-comment-bubble-tail" />
        </div>
      )}

      {/* ===== ヘッダー ===== */}
      <div className="home-header">
        <div className="home-header-inner">
          <div>
            <h1 className="app-title">英検2級</h1>
            <p className="app-subtitle">単語・熟語トレーナー</p>
          </div>
          <button className="btn-gear" onClick={onOpenSettings} title="設定">⚙️</button>
        </div>
      </div>

      {/* ===== 未設定アラート ===== */}
      {!bothDatesSet && (
        <div className="date-unset-alert">
          ⚠️ {!record.testDate && !record.clearTargetDate
            ? "英検テスト日・全クリア目標日が未設定です"
            : !record.testDate
            ? "英検テスト日が未設定です"
            : "全クリア目標日が未設定です"}
          <button className="btn-text-small" onClick={onOpenSettings}>⚙️ 設定する</button>
        </div>
      )}

      {/* ===== 途中再開バナー ===== */}
      {savedSessionLabel && (
        <div className="resume-banner">
          <div className="resume-banner-info">
            <span className="resume-banner-icon">📌</span>
            <div>
              <p className="resume-banner-title">前回の続きがあります</p>
              <p className="resume-banner-sub">{savedSessionLabel}</p>
            </div>
          </div>
          <div className="resume-banner-actions">
            <button className="btn-resume" onClick={onResume}>続きから</button>
            <button className="btn-resume-clear" onClick={onClearSession}>✕</button>
          </div>
        </div>
      )}

      {/* ===== カウントダウン（2つ並び） ===== */}
      <div className="countdown-pair">
        <div className={`countdown-chip ${daysToClear !== null ? dayColorClass(daysToClear) : "days-unset"}`}>
          <span className="countdown-chip-label">全クリア目標まであと</span>
          {daysToClear !== null ? (
            <>
              <span className="countdown-chip-days">
                {daysToClear > 0 ? daysToClear : daysToClear === 0 ? "今日！" : "期限超"}
              </span>
              {daysToClear > 0 && <span className="countdown-chip-unit">日</span>}
              <span className="countdown-chip-date">{formatDate(record.clearTargetDate)}</span>
            </>
          ) : (
            <span className="countdown-chip-unset">未設定</span>
          )}
        </div>
        <div className={`countdown-chip ${daysToTest !== null ? dayColorClass(daysToTest) : "days-unset"}`}>
          <span className="countdown-chip-label">英検テストまであと</span>
          {daysToTest !== null ? (
            <>
              <span className="countdown-chip-days">
                {daysToTest > 0 ? daysToTest : daysToTest === 0 ? "今日！" : "終了"}
              </span>
              {daysToTest > 0 && <span className="countdown-chip-unit">日</span>}
              <span className="countdown-chip-date">{formatDate(record.testDate)}</span>
            </>
          ) : (
            <span className="countdown-chip-unset">未設定</span>
          )}
        </div>
      </div>

      {/* ===== 今日の進捗カード ===== */}
      <div className="daily-progress-area">
        <DailyProgressCard label="今日の新履修数" value={todayNewCount} target={record.dailyNewTarget} />
        <DailyProgressCard label="今日のクリア数" value={todayClearCount} target={record.dailyClearTarget} />
      </div>

      <p className="streak-message">{streakMsg}</p>

      {/* ===== 学習開始ボタン ===== */}
      <div className="button-group">
        <button
          className="btn-primary btn-large"
          onClick={() => onStart("today")}
          disabled={neverAnsweredCount === 0}
        >
          未履修単語を学ぶ
          {neverAnsweredCount > 0 && <span className="badge">{neverAnsweredCount}語</span>}
        </button>

        <button
          className="btn-uncleared btn-large"
          onClick={() => onStart("uncleared")}
          disabled={unclearedCount === 0}
        >
          本日間違えた未クリア単語
          {unclearedCount > 0 && <span className="badge">{unclearedCount}語</span>}
        </button>

        <button
          className="btn-prevday btn-large"
          onClick={() => onStart("prevDayWrong")}
          disabled={prevDayCount === 0}
        >
          前日間違えた単語
          {prevDayCount > 0
            ? <span className="badge">{prevDayCount}語</span>
            : <span className="badge-zero">未クリア残0件</span>}
        </button>

        <button
          className="btn-fiveday btn-large"
          onClick={() => onStart("fourDayReview")}
          disabled={fourDayCount === 0}
        >
          4日前・翌日復習で正解した単語
          {fourDayCount > 0
            ? <span className="badge">{fourDayCount}語</span>
            : <span className="badge-zero">対象0件</span>}
        </button>

        <button
          className="btn-level-select btn-large"
          onClick={() => setShowLevelSelect(v => !v)}
        >
          レベルを選んで練習 {showLevelSelect ? "▲" : "▼"}
        </button>

        {showLevelSelect && (
          <div className="level-select-grid">
            {(() => {
              const currentIdx = LEVEL_ORDER.indexOf(record.currentLevel);
              return levelStats.map(({ level, total, cleared }) => {
                const levelIdx  = LEVEL_ORDER.indexOf(level as Level);
                const isCurrent = level === record.currentLevel;
                const isCleared = levelIdx < currentIdx;
                const isLocked  = levelIdx > currentIdx;
                const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
                return (
                  <button
                    key={level}
                    className={`level-select-btn ${isLocked ? "locked" : ""}`}
                    style={{ borderColor: isLocked ? "#cbd5e1" : LEVEL_COLORS[level as Level] }}
                    disabled={isLocked}
                    onClick={() => { if (!isLocked) { setShowLevelSelect(false); onStartByLevel(level as Level); } }}
                  >
                    <span className="level-select-name" style={{ color: isLocked ? "#94a3b8" : LEVEL_COLORS[level as Level] }}>
                      {isLocked && "🔒 "}{isCleared && "✅ "}{isCurrent && "★ "}{level}
                    </span>
                    <span className="level-select-status">
                      {isLocked ? "前のレベルをクリアしてから" : `${cleared}/${total}語クリア (${pct}%)`}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        )}

        {/* ===== 称号（バッジ） ===== */}
        <button
          className="btn-achievements-toggle btn-large"
          onClick={() => setShowAchievements(v => !v)}
        >
          🏅 称号 {earnedCount}/{achievements.length} {showAchievements ? "▲" : "▼"}
        </button>

        {showAchievements && (
          <div className="achievements-grid">
            {achievements.map((a) => (
              <div key={a.id} className={`achievement-badge ${a.earned ? "earned" : "locked"}`}>
                <span className="achievement-emoji">{a.earned ? a.emoji : "🔒"}</span>
                <span className="achievement-label">{a.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ===== ファイナルステージ ===== */}
        <div className={`final-stage-section ${finalUnlocked ? "unlocked" : "locked"}`}>
          <div className="final-stage-header">
            <span className="final-stage-crown">{finalUnlocked ? "🏆" : "🔒"}</span>
            <span className="final-stage-title">FINAL STAGE</span>
            {finalUnlocked && <span className="final-stage-badge">解放！</span>}
          </div>
          {finalUnlocked ? (
            <>
              <p className="final-stage-desc">
                一度でも間違えた単語 <strong>{finalInfo.total}語</strong> を3ステージで総復習
              </p>
              <div className="final-stage-buttons">
                {([1, 2, 3] as const).map((stage) => {
                  const prog = finalProgress[stage - 1];
                  const stageUnlocked = isFinalSubStageUnlocked(finalProgress, stage);
                  const isDone = prog.total > 0 && prog.isCleared;
                  return (
                    <button
                      key={stage}
                      className={`btn-final-stage s${stage} ${stageUnlocked ? "" : "locked"} ${isDone ? "done" : ""}`}
                      disabled={!stageUnlocked || prog.total === 0}
                      onClick={() => onStart(`finalStage${stage}` as StudyMode)}
                    >
                      <span className="fs-label">
                        {!stageUnlocked ? "🔒 " : isDone ? "✅ " : ""}Stage {stage}
                      </span>
                      <span className="fs-count">
                        {stageUnlocked ? `${prog.cleared}/${prog.total}語` : "前のステージをクリア"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="final-stage-review-buttons">
                <button
                  className="btn-fs-review prevday"
                  onClick={() => onStart("finalStagePrevDayWrong")}
                  disabled={finalPrevDayCount === 0}
                >
                  FS前日間違えた単語
                  {finalPrevDayCount > 0
                    ? <span className="badge">{finalPrevDayCount}語</span>
                    : <span className="badge-zero">対象0件</span>}
                </button>
                <button
                  className="btn-fs-review fourday"
                  onClick={() => onStart("finalStageFourDayReview")}
                  disabled={finalFourDayCount === 0}
                >
                  FS4日後復習
                  {finalFourDayCount > 0
                    ? <span className="badge">{finalFourDayCount}語</span>
                    : <span className="badge-zero">対象0件</span>}
                </button>
              </div>
            </>
          ) : (
            <p className="final-stage-hint">
              全レベルの未履修をすべて学習し、未クリア単語をなくすと解放されます
            </p>
          )}
        </div>
      </div>

      {/* ===== 進捗パネル ===== */}
      <ProgressPanel record={record} />
      <p className="current-level-text">現在のレベル：<strong>{record.currentLevel}</strong></p>

      {/* ===== リセット ===== */}
      <div className="reset-area">
        <button className="btn-reset" onClick={() => { setResetSelectedLevels([]); setShowResetModal(true); }}>
          🗑️ 学習記録をリセット
        </button>
      </div>

      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">学習記録をリセット</h3>
            <p className="modal-body">リセットする級を選んでください</p>
            <div className="reset-level-list">
              {LEVEL_ORDER.map(level => {
                const stat = levelStats.find(s => s.level === level);
                const isChecked = resetSelectedLevels.includes(level);
                return (
                  <label key={level} className="reset-level-item">
                    <input type="checkbox" checked={isChecked} onChange={() => toggleResetLevel(level)} />
                    <span className="reset-level-name" style={{ color: LEVEL_COLORS[level] }}>{level}</span>
                    {level === record.currentLevel && <span className="reset-level-current">★ 現在</span>}
                    <span className="reset-level-stats">{stat?.cleared ?? 0}/{stat?.total ?? 0}語</span>
                  </label>
                );
              })}
            </div>
            <p className="modal-warning">⚠️ 選択した級の学習記録が削除されます。<br />この操作は元に戻せません。</p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowResetModal(false)}>キャンセル</button>
              <button
                className="modal-btn-confirm"
                disabled={resetSelectedLevels.length === 0}
                onClick={() => { onResetLevels(resetSelectedLevels); setShowResetModal(false); setResetSelectedLevels([]); }}
              >
                リセット（{resetSelectedLevels.length}級）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
