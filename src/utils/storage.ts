// ==========================================
// ローカルストレージ操作ユーティリティ
// ==========================================

import type { StudyRecord, WordStat, SavedSession } from "../types";

const STORAGE_KEY = "eiken_study_record";

const defaultRecord: StudyRecord = {
  totalAnswered: 0,
  totalCorrect: 0,
  totalWrong: 0,
  streakDays: 0,
  currentLevel: "入門",
  learnedWordIds: [],
  masteredWordIds: [],
  weakWordIds: [],
  reviewToday: [],
  reviewTomorrow: [],
  lastStudiedDate: "",
  testDate: "",
  clearTargetDate: "",
  audioOnlyMode: false,
  sessionLength: 10,
  dailyNewTarget: 20,
  dailyClearTarget: 10,
  wordStats: {},
  shareCode: "",
  lastTargetCalcDate: "",
};

const SHARE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateShareCode = (): string =>
  Array.from({ length: 6 }, () =>
    SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)]
  ).join("");

export const getTodayString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 今日から指定日までの日数（マイナスは過去、未設定ならnull）
export const daysUntil = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const loadRecord = (): StudyRecord => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let rec: StudyRecord;
    if (!raw) {
      rec = { ...defaultRecord };
    } else {
      const parsed = JSON.parse(raw) as StudyRecord;
      rec = { ...defaultRecord, ...parsed };
    }
    if (!rec.shareCode) {
      rec.shareCode = generateShareCode();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    }
    return rec;
  } catch {
    return { ...defaultRecord, shareCode: generateShareCode() };
  }
};

export const saveRecord = (record: StudyRecord): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("保存エラー:", e);
  }
};

// 単語がクリア済みかどうかを判定する
// ・一度も間違えていない → 1回正解でクリア
// ・間違えたことがある  → 3連続正解でクリア
export const isWordCleared = (stat: WordStat): boolean => {
  if (stat.wrongCount === 0 && stat.consecutiveCorrect >= 1) return true;
  if (stat.consecutiveCorrect >= 3) return true;
  return false;
};

export const ensureWordStat = (record: StudyRecord, wordId: string): WordStat => {
  if (!record.wordStats[wordId]) {
    record.wordStats[wordId] = {
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      consecutiveCorrect: 0,
      firstAnsweredDate: "",
      lastAnsweredDate: "",
      lastWrongDate: "",
      prevDayCorrectDate: "",
      clearedDate: "",
      mastered: false,
      weakWord: false,
      finalStageClearedDate: "",
      finalStageLastWrongDate: "",
      finalStagePrevDayCorrectDate: "",
    };
  }
  const stat = record.wordStats[wordId];
  // 後方互換：firstAnsweredDateがない既存データに空文字を補完
  if (stat.firstAnsweredDate === undefined) stat.firstAnsweredDate = "";
  // 既存データにclearedDateがない場合の補完
  if (stat.clearedDate === undefined) stat.clearedDate = "";
  // 後方互換：prevDayCorrectDateがない既存データに空文字を補完
  if (stat.prevDayCorrectDate === undefined) stat.prevDayCorrectDate = "";
  // 後方互換：finalStageClearedDateがない既存データに空文字を補完
  if (stat.finalStageClearedDate === undefined) stat.finalStageClearedDate = "";
  // 後方互換：finalStageLastWrongDate/finalStagePrevDayCorrectDateがない既存データに空文字を補完
  if (stat.finalStageLastWrongDate === undefined) stat.finalStageLastWrongDate = "";
  if (stat.finalStagePrevDayCorrectDate === undefined) stat.finalStagePrevDayCorrectDate = "";
  // 後方互換：新ルールでクリア済みになる単語のclearedDateを補完
  if (stat.clearedDate === "" && isWordCleared(stat)) {
    stat.clearedDate = stat.lastAnsweredDate || getTodayString();
  }
  return stat;
};

export const recordCorrect = (record: StudyRecord, wordId: string): void => {
  const stat = ensureWordStat(record, wordId);
  const today = getTodayString();
  if (stat.answeredCount === 0) stat.firstAnsweredDate = today;
  stat.answeredCount++;
  stat.correctCount++;
  stat.consecutiveCorrect++;
  stat.lastAnsweredDate = today;
  record.totalAnswered++;
  record.totalCorrect++;

  // クリア判定：一度も間違えていない→1回正解、間違えたことある→3連続正解
  if (isWordCleared(stat)) {
    stat.clearedDate = today;
  }

  if (!record.learnedWordIds.includes(wordId)) {
    record.learnedWordIds.push(wordId);
  }
};

// 不確かとマークされた単語の処理（間違いと同じ扱い）
export const recordUncertain = (record: StudyRecord, wordId: string): void => {
  const stat = ensureWordStat(record, wordId);
  const today = getTodayString();
  if (stat.answeredCount === 0) stat.firstAnsweredDate = today;
  stat.answeredCount++;
  stat.wrongCount++;
  stat.consecutiveCorrect = 0;
  stat.clearedDate = "";
  stat.lastAnsweredDate = today;
  stat.lastWrongDate = today;
  record.totalAnswered++;
  record.totalWrong++;
};

export const recordWrong = (record: StudyRecord, wordId: string): void => {
  const stat = ensureWordStat(record, wordId);
  const today = getTodayString();
  if (stat.answeredCount === 0) stat.firstAnsweredDate = today;
  stat.answeredCount++;
  stat.wrongCount++;
  stat.consecutiveCorrect = 0;
  stat.clearedDate = "";        // 不正解でクリア状態をリセット
  stat.lastAnsweredDate = today;
  stat.lastWrongDate = today;
  record.totalAnswered++;
  record.totalWrong++;
};

// ファイナルステージで不正解/不確かだったときの処理
// 通常学習のクリア状態（consecutiveCorrect・clearedDate・lastWrongDate）や本日の復習キューには影響させない。
// ファイナルステージの間違いで入門〜最上級のクリア進捗や「本日間違えた単語」に紛れ込むと学習者の負担が大きいため、
// ファイナルステージ専用フィールド（finalStageClearedDate・finalStageLastWrongDate）だけを更新する。
export const recordFinalStageMiss = (record: StudyRecord, wordId: string): void => {
  const stat = ensureWordStat(record, wordId);
  const today = getTodayString();
  if (stat.answeredCount === 0) stat.firstAnsweredDate = today;
  stat.answeredCount++;
  stat.wrongCount++;
  stat.lastAnsweredDate = today;
  stat.finalStageLastWrongDate = today;
  record.totalAnswered++;
  record.totalWrong++;
};

export const addToReviewToday = (record: StudyRecord, wordId: string): void => {
  if (!record.reviewToday.includes(wordId)) {
    record.reviewToday.push(wordId);
  }
};

export const updateStreak = (record: StudyRecord): void => {
  const today = getTodayString();
  if (record.lastStudiedDate === "") {
    record.streakDays = 1;
  } else {
    const last = new Date(record.lastStudiedDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // 同じ日は何もしない
    } else if (diffDays === 1) {
      record.streakDays++;
    } else {
      record.streakDays = 1;
    }
  }
  record.lastStudiedDate = today;
};

// 現在レベルの単語が全てクリア（isWordCleared基準で統一）でレベルアップ可能
export const checkLevelUp = (
  record: StudyRecord,
  currentLevelWordIds: string[]
): boolean => {
  if (currentLevelWordIds.length === 0) return false;
  // クリア済み、または4日後復習パイプライン入り（prevDayCorrectDate設定済み）でレベルアップ可
  return currentLevelWordIds.every((id) => {
    const stat = record.wordStats[id];
    return stat && (isWordCleared(stat) || Boolean(stat.prevDayCorrectDate));
  });
};

// クリア済みレベルの記録を保持しつつ、現在レベル以上をリセットする
// idsToKeep: クリア済みレベルの単語ID（保持対象）
export const partialReset = (record: StudyRecord, idsToKeep: string[]): StudyRecord => {
  const keepSet = new Set(idsToKeep);
  const keptWordStats: Record<string, WordStat> = {};
  for (const [id, stat] of Object.entries(record.wordStats)) {
    if (keepSet.has(id)) keptWordStats[id] = stat;
  }
  return {
    ...defaultRecord,
    currentLevel: record.currentLevel,
    testDate: record.testDate,
    wordStats: keptWordStats,
    learnedWordIds: record.learnedWordIds.filter((id) => keepSet.has(id)),
  };
};

export const resetRecord = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// ====== クイズセッション途中保存 ======
const SESSION_KEY = "eiken_quiz_session";

export const saveQuizSession = (session: SavedSession): void => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
};

export const loadQuizSession = (): SavedSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
};

export const clearQuizSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

// ====== 保護者コメントの既読管理 ======
const COMMENT_READ_KEY = "eiken_comment_read_at";

export const getCommentReadAt = (): string => {
  try {
    return localStorage.getItem(COMMENT_READ_KEY) ?? "";
  } catch {
    return "";
  }
};

export const setCommentReadAt = (sentAt: string): void => {
  try {
    localStorage.setItem(COMMENT_READ_KEY, sentAt);
  } catch {}
};
