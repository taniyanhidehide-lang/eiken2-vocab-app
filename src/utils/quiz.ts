// ==========================================
// クイズロジック
// 出題する単語を選んだり、復習アルゴリズムを処理します
// ==========================================

import type { Word, StudyRecord, QuizItem, StudyMode } from "../types";
import { words } from "../data/words";
import { getTodayString, isWordCleared } from "./storage";

// 配列をシャッフルする（Fisher-Yatesアルゴリズム）
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 単語の選択肢をシャッフルした新しい Word を返す（元データは変更しない）
const shuffleChoices = (word: Word): Word => {
  const order = shuffle([0, 1, 2, 3]);
  return {
    ...word,
    choices: order.map(i => word.choices[i]),
    correctChoiceIndex: order.indexOf(word.correctChoiceIndex),
  };
};

// IDから単語を検索する
const findWordById = (id: string): Word | undefined =>
  words.find((w) => w.id === id);

// n日前の日付をYYYY-MM-DD形式で返す
const getDateBefore = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 新しい単語を学ぶモード（today）：一度も答えたことがない初見単語を中心に出題
export const buildQuizList = (
  record: StudyRecord,
  mode: StudyMode,
  sessionLimit = 20
): QuizItem[] => {
  if (mode === "uncleared") return buildUnclearedList(record, sessionLimit);
  if (mode === "prevDayWrong") return buildPrevDayWrongList(record, sessionLimit);
  if (mode === "fourDayReview") return buildFourDayReviewList(record, sessionLimit);

  // mode === "today" — 初見単語（answeredCount === 0）を優先
  const currentLevelWords = words.filter((w) => w.level === record.currentLevel);

  // 一度も答えたことがない単語
  const neverAnswered = currentLevelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return !stat || stat.answeredCount === 0;
  });

  // 答えたことはあるがまだ未クリアの単語（間違い・不確か）
  const triedButUncleared = currentLevelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.answeredCount > 0 && !isWordCleared(stat);
  });

  const combined: QuizItem[] = [
    ...shuffle(neverAnswered).map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false })),
    ...shuffle(triedButUncleared).map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false })),
  ];
  return combined.slice(0, sessionLimit);
};

// 本日間違えた未クリア単語リスト（lastWrongDate===今日 && まだクリアされていない）
export const buildUnclearedList = (
  record: StudyRecord,
  sessionLimit = 20
): QuizItem[] => {
  const today = getTodayString();
  const levelWords = words.filter((w) => w.level === record.currentLevel);
  const uncleared = levelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.lastWrongDate === today && !isWordCleared(stat);
  });
  return shuffle(uncleared)
    .slice(0, sessionLimit)
    .map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false }));
};

// 前日以前に間違えた単語リスト（全レベル対象・lastWrongDate<今日 && 前日正解レビュー未実施）
export const buildPrevDayWrongList = (
  record: StudyRecord,
  sessionLimit = 20
): QuizItem[] => {
  const today = getTodayString();
  // 前の級の単語も含む（級が上がっても前の級の復習を続けられるよう全レベル対象）
  const result = words.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.lastWrongDate && stat.lastWrongDate < today && !stat.prevDayCorrectDate;
  });
  return shuffle(result)
    .slice(0, sessionLimit)
    .map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: true }));
};

// 4日後復習リスト（全レベル対象・prevDayWrongモードで正解してから4日以上経過した単語）
export const buildFourDayReviewList = (
  record: StudyRecord,
  sessionLimit = 20
): QuizItem[] => {
  const cutoff = getDateBefore(4);
  const result: QuizItem[] = [];
  // 前の級の単語も含む（全レベル対象）
  for (const [id, stat] of Object.entries(record.wordStats)) {
    if (stat.prevDayCorrectDate && stat.prevDayCorrectDate <= cutoff) {
      const word = findWordById(id);
      if (word) result.push({ word: shuffleChoices(word), isReview: true, isReviewToday: false, isPrevDayReview: false });
    }
  }
  return shuffle(result).slice(0, sessionLimit);
};

// 現在レベルの未履修単語数（answeredCount === 0）を返す（ホーム画面バッジ用）
export const countNeverAnsweredWords = (record: StudyRecord): number => {
  const levelWords = words.filter((w) => w.level === record.currentLevel);
  return levelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return !stat || stat.answeredCount === 0;
  }).length;
};

// 本日間違えた未クリア単語数（クリア済みは除く）
export const countUnclearedWords = (record: StudyRecord): number => {
  const today = getTodayString();
  const levelWords = words.filter((w) => w.level === record.currentLevel);
  return levelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.lastWrongDate === today && !isWordCleared(stat);
  }).length;
};

// 前日以前に間違えた単語数（全レベル対象・前日正解レビュー未実施のもの）
export const countPrevDayWrongWords = (record: StudyRecord): number => {
  const today = getTodayString();
  return words.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.lastWrongDate && stat.lastWrongDate < today && !stat.prevDayCorrectDate;
  }).length;
};

// 4日後復習単語数（全レベル対象・ホーム画面バッジ用）
export const countFourDayReviewWords = (record: StudyRecord): number => {
  const cutoff = getDateBefore(4);
  return Object.values(record.wordStats).filter(
    (s) => s.prevDayCorrectDate && s.prevDayCorrectDate <= cutoff
  ).length;
};

// 前のレベルに残っている4日後復習単語数を返す（警告用）
export const countPrevLevelFourDayReviewWords = (record: StudyRecord): number => {
  const LEVELS = ["入門", "初級", "中級", "上級", "最上級"] as const;
  const currentIdx = LEVELS.indexOf(record.currentLevel);
  if (currentIdx === 0) return 0;
  const cutoff = getDateBefore(4);
  const prevLevelIds = new Set(
    words
      .filter((w) => LEVELS.indexOf(w.level) < currentIdx)
      .map((w) => w.id)
  );
  return Object.entries(record.wordStats).filter(
    ([id, s]) => prevLevelIds.has(id) && s.prevDayCorrectDate && s.prevDayCorrectDate <= cutoff
  ).length;
};

// 再履修用の問題リストを作成する（当日間違えた単語）
export const buildReviewTodayList = (record: StudyRecord): QuizItem[] => {
  const result: QuizItem[] = [];
  for (const id of record.reviewToday) {
    const word = findWordById(id);
    if (word) {
      result.push({ word: shuffleChoices(word), isReview: false, isReviewToday: true, isPrevDayReview: false });
    }
  }
  return shuffle(result);
};

// 正解後の処理
export const handleCorrectAnswer = (
  record: StudyRecord,
  wordId: string,
  isReviewToday: boolean,
  isFourDayReview = false,
  isPrevDayReview = false
): void => {
  if (isReviewToday) {
    record.reviewToday = record.reviewToday.filter((id) => id !== wordId);
    // 再履修で正解 → 今日のクリア数にカウントするため clearedDate をセット
    const stat = record.wordStats[wordId];
    if (stat && stat.wrongCount > 0) {
      stat.clearedDate = getTodayString();
    }
  }
  if (isPrevDayReview) {
    // 前日間違えで正解 → prevDayCorrectDate = 今日（4日後に復習リストへ）
    const stat = record.wordStats[wordId];
    if (stat) {
      stat.prevDayCorrectDate = getTodayString();
    }
  }
  if (isFourDayReview) {
    // 4日後復習で正解 → prevDayCorrectDate を今日に更新（前日間違えには戻らず、次の4日後復習へ）
    const stat = record.wordStats[wordId];
    if (stat) {
      stat.prevDayCorrectDate = getTodayString();
    }
  }
};

// 不正解後の処理（通常問題 → reviewTodayに追加）
export const handleWrongAnswer = (
  record: StudyRecord,
  wordId: string,
  isReviewToday: boolean
): void => {
  if (!isReviewToday) {
    if (!record.reviewToday.includes(wordId)) {
      record.reviewToday.push(wordId);
    }
  }
};

// 指定レベルの単語からクイズリストを作る（レベル選択練習用）
export const buildQuizByLevel = (
  record: StudyRecord,
  level: string,
  sessionLimit = 20
): QuizItem[] => {
  const levelWords = words.filter((w) => w.level === level);

  // 未クリアを優先、次にクリア済みを混ぜる
  const uncleared = levelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return !stat || !isWordCleared(stat);
  });
  const cleared = levelWords.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && isWordCleared(stat);
  });

  const combined: QuizItem[] = [
    ...shuffle(uncleared).map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false })),
    ...shuffle(cleared).map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false })),
  ];
  return combined.slice(0, sessionLimit);
};

// 各レベルの単語数とクリア済み数を返す（ホーム画面のレベル選択UI用）
export const getLevelStats = (record: StudyRecord) => {
  const LEVELS = ["入門", "初級", "中級", "上級", "最上級"] as const;
  return LEVELS.map((level) => {
    const levelWords = words.filter((w) => w.level === level);
    const total = levelWords.length;
    const cleared = levelWords.filter((w) => {
      const stat = record.wordStats[w.id];
      return stat && isWordCleared(stat);
    }).length;
    return { level, total, cleared };
  });
};

// 今日初めて学習した単語数（新履修数）
export const countTodayNewWords = (record: StudyRecord): number => {
  const today = getTodayString();
  return Object.values(record.wordStats).filter(
    (stat) => stat.firstAnsweredDate === today
  ).length;
};

// 今日クリアした単語数（一度でも間違えた・不確かにした単語のうち、今日クリアになったもの）
export const countTodayClearedWords = (record: StudyRecord): number => {
  const today = getTodayString();
  return Object.values(record.wordStats).filter(
    (stat) => stat.clearedDate === today && stat.wrongCount > 0
  ).length;
};

// ファイナルステージ解放条件チェック
// 全単語が履修済み かつ（クリア済み OR 4日後復習待ち）であれば true
export const isFinalStageUnlocked = (record: StudyRecord): boolean => {
  for (const w of words) {
    const stat = record.wordStats[w.id];
    if (!stat || stat.answeredCount === 0) return false;
    if (!isWordCleared(stat) && !stat.prevDayCorrectDate) return false;
  }
  return true;
};

// wrongCount>0の単語をwords配列の順（入門→最上級）で3分割する
const splitFinalStageWords = (record: StudyRecord): [Word[], Word[], Word[]] => {
  const wrongWords = words.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.wrongCount > 0;
  });
  const total = wrongWords.length;
  const s1End = Math.ceil(total / 3);
  const s2End = Math.ceil((total * 2) / 3);
  return [wrongWords.slice(0, s1End), wrongWords.slice(s1End, s2End), wrongWords.slice(s2End, total)];
};

// ファイナルステージ用語数情報（wrongCount>0の単語を3分割）
export const countFinalStageInfo = (
  record: StudyRecord
): { total: number; s1: number; s2: number; s3: number } => {
  const [s1, s2, s3] = splitFinalStageWords(record);
  return { total: s1.length + s2.length + s3.length, s1: s1.length, s2: s2.length, s3: s3.length };
};

// ファイナルステージ問題リスト（stage 1〜3）
// そのステージ内でまだ正解していない単語を優先して出題する
export const buildFinalStageList = (
  record: StudyRecord,
  stage: 1 | 2 | 3,
  sessionLimit = 20
): QuizItem[] => {
  const stageWords = splitFinalStageWords(record)[stage - 1];
  if (stageWords.length === 0) return [];
  const remaining = stageWords.filter((w) => !record.wordStats[w.id]?.finalStageClearedDate);
  const pool = remaining.length > 0 ? remaining : stageWords;
  return shuffle(pool)
    .slice(0, sessionLimit)
    .map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: false }));
};

// ファイナルステージ各ステージのクリア進捗
export interface FinalStageProgress {
  total: number;
  cleared: number;
  isCleared: boolean; // そのステージの対象語がすべてクリア済み（対象0語も含む）
}

// 各ステージの「cleared/total」と、次ステージへ進めるかの判定に使う
// クリア判定はファイナルステージのセッション内で正解したかどうか（finalStageClearedDate）のみを見る
// ※ isWordCleared（通常学習での3連続正解）は使わない。ファイナルステージ解放条件が
//    「全単語クリア済み」であるため、そちらを使うと解放と同時に全ステージが完了扱いになってしまう
export const computeFinalStageProgress = (
  record: StudyRecord
): [FinalStageProgress, FinalStageProgress, FinalStageProgress] => {
  return splitFinalStageWords(record).map((stageWords) => {
    const cleared = stageWords.filter((w) => record.wordStats[w.id]?.finalStageClearedDate).length;
    return { total: stageWords.length, cleared, isCleared: stageWords.length === 0 || cleared === stageWords.length };
  }) as [FinalStageProgress, FinalStageProgress, FinalStageProgress];
};

// 指定ステージに挑戦できるか（Stage1は常に解放、Stage2/3は前ステージ全クリアで解放）
export const isFinalSubStageUnlocked = (
  progress: [FinalStageProgress, FinalStageProgress, FinalStageProgress],
  stage: 1 | 2 | 3
): boolean => {
  if (stage === 1) return true;
  if (stage === 2) return progress[0].isCleared;
  return progress[0].isCleared && progress[1].isCleared;
};

// ===== ファイナルステージ専用の間隔復習（前日間違え → 4日後復習） =====
// 入門〜最上級の通常サイクル（lastWrongDate/prevDayCorrectDate）とは別フィールドで管理し、
// 通常の「前日間違えた単語」「4日後復習」には混ざらないようにする。

// FS前日以前に間違えた単語リスト
export const buildFinalStagePrevDayWrongList = (
  record: StudyRecord,
  sessionLimit = 20
): QuizItem[] => {
  const today = getTodayString();
  const result = words.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.finalStageLastWrongDate && stat.finalStageLastWrongDate < today && !stat.finalStagePrevDayCorrectDate;
  });
  return shuffle(result)
    .slice(0, sessionLimit)
    .map((w) => ({ word: shuffleChoices(w), isReview: false, isReviewToday: false, isPrevDayReview: true }));
};

// FS前日以前に間違えた単語数（ホーム画面バッジ用）
export const countFinalStagePrevDayWrongWords = (record: StudyRecord): number => {
  const today = getTodayString();
  return words.filter((w) => {
    const stat = record.wordStats[w.id];
    return stat && stat.finalStageLastWrongDate && stat.finalStageLastWrongDate < today && !stat.finalStagePrevDayCorrectDate;
  }).length;
};

// FS4日後復習リスト
export const buildFinalStageFourDayReviewList = (
  record: StudyRecord,
  sessionLimit = 20
): QuizItem[] => {
  const cutoff = getDateBefore(4);
  const result: QuizItem[] = [];
  for (const [id, stat] of Object.entries(record.wordStats)) {
    if (stat.finalStagePrevDayCorrectDate && stat.finalStagePrevDayCorrectDate <= cutoff) {
      const word = findWordById(id);
      if (word) result.push({ word: shuffleChoices(word), isReview: true, isReviewToday: false, isPrevDayReview: false });
    }
  }
  return shuffle(result).slice(0, sessionLimit);
};

// FS4日後復習単語数（ホーム画面バッジ用）
export const countFinalStageFourDayReviewWords = (record: StudyRecord): number => {
  const cutoff = getDateBefore(4);
  return Object.values(record.wordStats).filter(
    (s) => s.finalStagePrevDayCorrectDate && s.finalStagePrevDayCorrectDate <= cutoff
  ).length;
};

// 今日の正解数と正答率を計算する
export const calcTodayStats = (
  record: StudyRecord
): { answered: number; correct: number; rate: number } => {
  const today = getTodayString();
  let answered = 0;
  let correct = 0;
  for (const stat of Object.values(record.wordStats)) {
    if (stat.lastAnsweredDate === today) {
      answered += stat.answeredCount;
      correct += stat.correctCount;
    }
  }
  const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  return { answered, correct, rate };
};
