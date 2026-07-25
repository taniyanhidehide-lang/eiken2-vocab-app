import { ref, set, get, update } from "firebase/database";
import { db } from "../firebase";
import type { StudyRecord } from "../types";
import { words } from "../data/words";
import { isWordCleared, getTodayString } from "./storage";
import { countTodayNewWords, countTodayClearedWords } from "./quiz";

const LEVELS = ["入門", "初級", "中級", "上級", "最上級"] as const;

export interface LevelProgress {
  name: string;
  cleared: number;
  total: number;
  pct: number;
}

// 保護者に通知する称号（バッジ）獲得情報
export interface AchievementNotice {
  emoji: string;
  label: string;
}

export interface ParentData {
  levels: LevelProgress[];
  currentLevel: string;
  lastStudied: string;
  streak: number;
  updatedAt: string;
  studyDate: string;    // データが記録された日付（YYYY-MM-DD）
  todayNew: number;     // 今日の新履修数
  todayCleared: number; // 今日のクリア数
  newAchievements: AchievementNotice[]; // 直近のセッションで新しく獲得した称号
}

// 保護者から子供へのコメント
export interface ParentComment {
  text: string;
  sentAt: string;      // ISO日時
  reaction?: string;    // 子供が送ったリアクション（絵文字）
  reactionAt?: string;  // リアクションを送った日時
}

const buildParentData = (record: StudyRecord, newAchievements: AchievementNotice[]): ParentData => {
  const levels = LEVELS.map(level => {
    const levelWords = words.filter(w => w.level === level);
    const total = levelWords.length;
    const cleared = levelWords.filter(w => {
      const stat = record.wordStats[w.id];
      return stat && isWordCleared(stat);
    }).length;
    return {
      name: level,
      cleared,
      total,
      pct: total > 0 ? Math.round((cleared / total) * 100) : 0,
    };
  });

  return {
    levels,
    currentLevel: record.currentLevel,
    lastStudied: record.lastStudiedDate || "",
    streak: record.streakDays,
    updatedAt: new Date().toISOString(),
    studyDate: getTodayString(),
    todayNew: countTodayNewWords(record),
    todayCleared: countTodayClearedWords(record),
    newAchievements,
  };
};

export const syncToFirebase = async (
  record: StudyRecord,
  newAchievements: AchievementNotice[] = []
): Promise<void> => {
  if (!record.shareCode) return;
  try {
    const data = buildParentData(record, newAchievements);
    await set(ref(db, `progress/${record.shareCode}`), data);
  } catch (e) {
    console.error("Firebase sync error:", e);
  }
};

export const fetchParentData = async (shareCode: string): Promise<ParentData | null> => {
  try {
    const snapshot = await get(ref(db, `progress/${shareCode}`));
    return snapshot.exists() ? (snapshot.val() as ParentData) : null;
  } catch (e) {
    console.error("Firebase fetch error:", e);
    return null;
  }
};

// 保護者からのコメントを送信
export const sendComment = async (shareCode: string, text: string): Promise<void> => {
  if (!shareCode || !text.trim()) return;
  try {
    const comment: ParentComment = { text: text.trim(), sentAt: new Date().toISOString() };
    await set(ref(db, `comments/${shareCode}`), comment);
  } catch (e) {
    console.error("Firebase comment send error:", e);
  }
};

// 子供側でコメントを取得
export const fetchComment = async (shareCode: string): Promise<ParentComment | null> => {
  if (!shareCode) return null;
  try {
    const snapshot = await get(ref(db, `comments/${shareCode}`));
    return snapshot.exists() ? (snapshot.val() as ParentComment) : null;
  } catch (e) {
    console.error("Firebase comment fetch error:", e);
    return null;
  }
};

// 子供からコメントへのリアクションを送信
export const sendCommentReaction = async (shareCode: string, reaction: string): Promise<void> => {
  if (!shareCode) return;
  try {
    await update(ref(db, `comments/${shareCode}`), {
      reaction,
      reactionAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Firebase reaction send error:", e);
  }
};
