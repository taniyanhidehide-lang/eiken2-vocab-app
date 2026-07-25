// ==========================================
// 1日の目標語数の自動計算
// 全クリア目標日までの残り日数と、レベル別の残り未履修語数から
// 「今日の新履修目標」を算出します。
// ==========================================

import type { Level, StudyRecord } from "../types";
import { words } from "../data/words";
import { daysUntil, getTodayString } from "./storage";

const LEVELS: Level[] = ["入門", "初級", "中級", "上級", "最上級"];

// レベルが上がるほど1語あたりの負荷が大きいとみなす重み
const LEVEL_WEIGHTS: Record<Level, number> = {
  入門: 1.0,
  初級: 1.15,
  中級: 1.35,
  上級: 1.6,
  最上級: 2.0,
};

// 残り未履修語数のうち、最終ステージ用に確保しておく割合
const FINAL_STAGE_RESERVE_RATIO = 0.2;

const MIN_TARGET = 5;
const MAX_TARGET = 60;
const TARGET_STEP = 5;

const clampToStep = (n: number): number => {
  const stepped = Math.ceil(n / TARGET_STEP) * TARGET_STEP;
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, stepped));
};

// レベルごとの残り未履修語数
const countRemainingByLevel = (record: StudyRecord): Record<Level, number> => {
  const counts: Record<Level, number> = { 入門: 0, 初級: 0, 中級: 0, 上級: 0, 最上級: 0 };
  for (const w of words) {
    const stat = record.wordStats[w.id];
    if (!stat || stat.answeredCount === 0) counts[w.level]++;
  }
  return counts;
};

// 全クリア目標日から、今日の新履修目標語数を自動算出する
// 目標日が未設定、またはすべて履修済みの場合はnullを返す（自動計算の対象外）
export const calcAutoDailyTarget = (record: StudyRecord): number | null => {
  const daysRemaining = daysUntil(record.clearTargetDate);
  if (daysRemaining === null) return null;

  const remainingByLevel = countRemainingByLevel(record);
  const totalRemaining = LEVELS.reduce((sum, lv) => sum + remainingByLevel[lv], 0);
  if (totalRemaining === 0) return null;

  const totalWork = LEVELS.reduce((sum, lv) => sum + remainingByLevel[lv] * LEVEL_WEIGHTS[lv], 0);
  const pacedWork = totalWork * (1 - FINAL_STAGE_RESERVE_RATIO); // 残りの20%は最終ステージ用に確保

  const effectiveDays = Math.max(1, daysRemaining);
  const dailyBudget = pacedWork / effectiveDays;
  const rawTarget = dailyBudget / LEVEL_WEIGHTS[record.currentLevel];

  return clampToStep(rawTarget);
};

// 自動計算した目標語数を record に反映する（1日1回だけ再計算）
// clearTargetDate未設定、または既に今日計算済みなら何もしない
export const applyAutoDailyTargets = (record: StudyRecord, force = false): StudyRecord => {
  const today = getTodayString();
  if (!force && record.lastTargetCalcDate === today) return record;

  const autoTarget = calcAutoDailyTarget(record);
  if (autoTarget === null) return record;

  return {
    ...record,
    dailyNewTarget: autoTarget,
    dailyClearTarget: autoTarget,
    lastTargetCalcDate: today,
  };
};
