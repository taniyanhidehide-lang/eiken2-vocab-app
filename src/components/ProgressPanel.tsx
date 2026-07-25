// ==========================================
// 進捗パネル
// ホーム画面でレベルごとの進捗を表示します
// ==========================================

import type { StudyRecord, Level } from "../types";
import { words } from "../data/words";
import { isWordCleared } from "../utils/storage";

interface Props {
  record: StudyRecord;
}

const LEVELS: Level[] = ["入門", "初級", "中級", "上級", "最上級"];

const LEVEL_COLORS: Record<Level, string> = {
  入門: "#4ade80",
  初級: "#60a5fa",
  中級: "#f59e0b",
  上級: "#f87171",
  最上級: "#a78bfa",
};

// レベルアップ条件：現在レベルの単語の95%が3連続正解（クリア）
const LEVELUP_THRESHOLD = 100;

export const ProgressPanel = ({ record }: Props) => {
  const currentLevelWords = words.filter((w) => w.level === record.currentLevel);
  const currentLevelWordIds = currentLevelWords.map((w) => w.id);
  const totalCurrentLevel = currentLevelWordIds.length;

  const clearedCurrentLevel = currentLevelWordIds.filter((id) => {
    const stat = record.wordStats[id];
    return stat && isWordCleared(stat);
  }).length;

  const clearedPct =
    totalCurrentLevel > 0
      ? Math.round((clearedCurrentLevel / totalCurrentLevel) * 100)
      : 0;

  const canLevelUp = clearedPct >= LEVELUP_THRESHOLD;

  return (
    <div className="progress-panel">
      <h3 className="progress-title">レベル別進捗</h3>
      {LEVELS.map((level) => {
        const levelWords = words.filter((w) => w.level === level);
        const total = levelWords.length;
        const cleared = levelWords.filter((w) => {
          const stat = record.wordStats[w.id];
          return stat && isWordCleared(stat);
        }).length;
        const pct = total > 0 ? Math.round((cleared / total) * 100) : 0;
        const isCurrent = record.currentLevel === level;

        return (
          <div key={level} className={`progress-row ${isCurrent ? "current" : ""}`}>
            <div className="progress-label">
              <span className="level-badge" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                {level}
              </span>
            </div>
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: LEVEL_COLORS[level],
                }}
              />
            </div>


            {/* 現在のレベルだけ合格ライン表示 */}
            {isCurrent && (
              <div className="levelup-meter">
                <div className="levelup-meter-labels">
                  <span
                    className="levelup-accuracy"
                    style={{
                      color: canLevelUp
                        ? "#16a34a"
                        : clearedPct >= LEVELUP_THRESHOLD - 10
                        ? "#d97706"
                        : "#dc2626",
                    }}
                  >
                    クリア率 {clearedPct}%
                  </span>
                  <span className="levelup-threshold">合格ライン {LEVELUP_THRESHOLD}%</span>
                </div>
                <div className="levelup-bar-wrap">
                  <div
                    className="levelup-bar-fill"
                    style={{
                      width: `${Math.min(clearedPct, 100)}%`,
                      backgroundColor: canLevelUp
                        ? "#16a34a"
                        : clearedPct >= LEVELUP_THRESHOLD - 10
                        ? "#f59e0b"
                        : "#ef4444",
                    }}
                  />
                  <div
                    className="levelup-threshold-mark"
                    style={{ left: `${LEVELUP_THRESHOLD}%` }}
                  />
                </div>
                {!canLevelUp && (
                  <div className="levelup-gap">
                    あと {totalCurrentLevel - clearedCurrentLevel} 語クリアでレベルアップ
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
