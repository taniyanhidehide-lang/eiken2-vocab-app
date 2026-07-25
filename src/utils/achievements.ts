// ==========================================
// 称号（バッジ）システム
// 既存の学習記録から条件判定するだけで、新しいデータは保存しない
// ==========================================

import type { StudyRecord, Level } from "../types";
import { getLevelStats, isFinalStageUnlocked, computeFinalStageProgress } from "./quiz";

export interface Achievement {
  id: string;
  emoji: string;
  label: string;
  earned: boolean;
}

const LEVEL_BADGES: { level: Level; emoji: string; label: string }[] = [
  { level: "入門",   emoji: "🌱", label: "入門マスター" },
  { level: "初級",   emoji: "🌿", label: "初級マスター" },
  { level: "中級",   emoji: "🌳", label: "中級マスター" },
  { level: "上級",   emoji: "🌲", label: "上級マスター" },
  { level: "最上級", emoji: "👑", label: "最上級マスター" },
];

export const computeAchievements = (record: StudyRecord): Achievement[] => {
  const levelStats = getLevelStats(record);
  const finalProgress = computeFinalStageProgress(record);
  const finalTotal = finalProgress.reduce((sum, p) => sum + p.total, 0);
  const finalConquered = isFinalStageUnlocked(record) && finalTotal > 0 && finalProgress.every((p) => p.isCleared);

  return [
    { id: "streak3",  emoji: "🔥", label: "3日連続学習",    earned: record.streakDays >= 3 },
    { id: "streak7",  emoji: "🔥", label: "7日連続学習",    earned: record.streakDays >= 7 },
    { id: "streak30", emoji: "🔥", label: "30日連続学習",   earned: record.streakDays >= 30 },
    { id: "correct50",  emoji: "💯", label: "累計50問正解",  earned: record.totalCorrect >= 50 },
    { id: "correct200", emoji: "💯", label: "累計200問正解", earned: record.totalCorrect >= 200 },
    { id: "correct500", emoji: "💯", label: "累計500問正解", earned: record.totalCorrect >= 500 },
    ...LEVEL_BADGES.map(({ level, emoji, label }) => {
      const stat = levelStats.find((s) => s.level === level);
      return {
        id: `level-${level}`,
        emoji,
        label,
        earned: !!stat && stat.total > 0 && stat.cleared === stat.total,
      };
    }),
    { id: "finalstage", emoji: "🏆", label: "FINAL STAGE制覇", earned: finalConquered },
  ];
};
