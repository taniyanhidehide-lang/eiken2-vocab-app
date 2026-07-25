import type { QuizResult, StudyRecord } from "../types";
import { words } from "../data/words";

interface Props {
  results: QuizResult[];
  record: StudyRecord;
  onReview: () => void;
  onHome: () => void;
  onStartNext: () => void;
  hasReviewToday: boolean;
  leveledUp?: boolean;
}

const getEncouragement = (rate: number): string => {
  if (rate === 100) return "パーフェクト！全問正解、最高です！🎉";
  if (rate >= 90)  return "すごい！ほぼ完璧です！この調子で続けよう！✨";
  if (rate >= 70)  return "よく頑張りました！苦手な単語をしっかり復習しよう！";
  if (rate >= 50)  return "まだまだこれから！復習で差をつけよう！";
  return "今日の間違いが明日の力になる！諦めずに続けよう！";
};

export const ResultScreen = ({
  results, record, onReview, onHome, onStartNext, hasReviewToday, leveledUp = false,
}: Props) => {
  const total   = results.length;
  const correct = results.filter(r => r.correct && !r.uncertain).length;
  const wrong   = total - correct;
  const rate    = total > 0 ? Math.round((correct / total) * 100) : 0;
  const slowCount = results.filter(r => r.slow).length;

  const wrongWords = results
    .filter(r => !r.correct || r.uncertain)
    .map(r => words.find(w => w.id === r.wordId))
    .filter(Boolean);

  const encouragement = getEncouragement(rate);

  return (
    <div className="screen result-screen">

      {leveledUp && (
        <div className="levelup-celebration">
          <div className="levelup-celebration-icon">🎉</div>
          <h3 className="levelup-celebration-title">レベルアップ！</h3>
          <p className="levelup-celebration-level">現在のレベル：<strong>{record.currentLevel}</strong></p>
        </div>
      )}

      <div className="result-header">
        <h2 className="result-title">学習完了！</h2>
        <p className="encouragement">{encouragement}</p>
      </div>

      <div className="result-stats">
        <div className="result-stat-card">
          <span className="result-stat-value">{total}</span>
          <span className="result-stat-label">問題数</span>
        </div>
        <div className="result-stat-card correct-card">
          <span className="result-stat-value">{correct}</span>
          <span className="result-stat-label">正解</span>
        </div>
        <div className="result-stat-card wrong-card">
          <span className="result-stat-value">{wrong}</span>
          <span className="result-stat-label">不正解・不確か</span>
        </div>
        <div className="result-stat-card rate-card">
          <span className="result-stat-value">{rate}%</span>
          <span className="result-stat-label">正答率</span>
        </div>
      </div>

      {slowCount > 0 && (
        <p className="slow-note">ゆっくり回答：{slowCount}問（3秒超え）</p>
      )}

      {wrongWords.length > 0 && (
        <div className="wrong-words-section">
          <h3 className="wrong-words-title">間違えた・不確かな単語（3回連続正解でクリア）</h3>
          <ul className="wrong-words-list">
            {wrongWords.map(w => (
              <li key={w!.id} className="wrong-word-item">
                <span className="wrong-word-en">{w!.word}</span>
                <span className="wrong-word-ja">{w!.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="result-actions">
        <button className="btn-primary btn-large" onClick={onStartNext}>
          次の問題へ →
        </button>
        {hasReviewToday && (
          <button className="btn-review btn-large" onClick={onReview}>
            再履修する（{record.reviewToday.length}語）
          </button>
        )}
        <button className="btn-secondary btn-large" onClick={onHome}>
          ホームに戻る
        </button>
      </div>
    </div>
  );
};
