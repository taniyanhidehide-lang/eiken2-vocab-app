// ==========================================
// 型定義ファイル
// 単語データと学習記録の型をまとめています
// ==========================================

// レベル名の型
export type Level = "入門" | "初級" | "中級" | "上級" | "最上級";

// 品詞の型
export type PartOfSpeech = "名詞" | "動詞" | "形容詞" | "副詞" | "前置詞" | "接続詞" | "熟語" | "その他";

// 単語データの型
export interface Word {
  id: string;
  word: string;
  meaning: string;
  partOfSpeech: PartOfSpeech;
  level: Level;
  importance: number; // 1〜5（5が最重要）
  exampleEn: string;
  exampleJa: string;
  choices: string[]; // 4つの選択肢（正解含む）
  correctChoiceIndex: number; // 正解のインデックス（0〜3）
  pronunciationText: string; // Web Speech APIに渡す発音テキスト
}

// 単語ごとの学習統計
export interface WordStat {
  answeredCount: number;      // 合計回答回数
  correctCount: number;       // 正解回数
  wrongCount: number;         // 不正解回数
  consecutiveCorrect: number; // 連続正解回数
  firstAnsweredDate: string;  // 初めて回答した日（YYYY-MM-DD、"" = 未回答）
  lastAnsweredDate: string;   // 最後に回答した日（YYYY-MM-DD）
  lastWrongDate: string;      // 最後に不正解だった日
  prevDayCorrectDate: string; // 前日間違えモードで正解した日（4日後に再復習の起点）
  clearedDate: string;        // 3連続正解を達成した日（"" = 未クリア）
  mastered: boolean;          // 後方互換のため保持
  weakWord: boolean;          // 後方互換のため保持
  finalStageClearedDate: string; // ファイナルステージのセッション内で正解した日（"" = 未クリア）
  finalStageLastWrongDate: string;      // ファイナルステージで最後に間違えた日（"" = なし）
  finalStagePrevDayCorrectDate: string; // ファイナルステージの前日復習で正解した日（4日後復習の起点）
}

// 学習記録全体の型
export interface StudyRecord {
  totalAnswered: number;        // 全問回答数
  totalCorrect: number;         // 全問正解数
  totalWrong: number;           // 全問不正解数
  streakDays: number;           // 連続学習日数
  currentLevel: Level;          // 現在のレベル
  learnedWordIds: string[];     // 後方互換のため保持
  masteredWordIds: string[];    // 後方互換のため保持
  weakWordIds: string[];        // 後方互換のため保持
  reviewToday: string[];        // 今日間違えた→再履修対象
  reviewTomorrow: string[];     // 後方互換のため保持
  lastStudiedDate: string;      // 最後に学習した日
  testDate: string;             // 英検テスト日（YYYY-MM-DD）、未設定なら空文字
  clearTargetDate: string;      // 全クリア目標日（YYYY-MM-DD）、未設定なら空文字
  audioOnlyMode: boolean;       // trueのとき英単語を非表示にして音声だけで出題する
  sessionLength: number;        // 1セッションの問題数（5/10/15/20/25/30）
  dailyNewTarget: number;       // 1日の新履修目標語数
  dailyClearTarget: number;     // 1日のクリア目標語数
  wordStats: Record<string, WordStat>; // 単語IDをキーにした統計
  shareCode: string;            // 保護者共有用のコード（6文字英数字）
  lastTargetCalcDate: string;   // 1日の目標語数を自動計算した最終日（YYYY-MM-DD）
}

// クイズの1問のデータ
export interface QuizItem {
  word: Word;
  isReview: boolean;        // true = 4日後復習アイテム
  isReviewToday: boolean;   // true = 再履修アイテム
  isPrevDayReview: boolean; // true = 前日間違えアイテム
}

// クイズの結果
export interface QuizResult {
  wordId: string;
  correct: boolean;
  slow: boolean;
  uncertain: boolean;
}

// 学習モード
export type StudyMode =
  | "today" | "uncleared" | "fourDayReview" | "prevDayWrong"
  | "finalStage1" | "finalStage2" | "finalStage3"
  | "finalStagePrevDayWrong" | "finalStageFourDayReview";

// 画面の種類
export type Screen = "home" | "quiz" | "result" | "settings";

// セッション情報（「次の問題へ」や途中再開で同じモードを再開するため）
export type SessionInfo =
  | { type: "mode"; mode: StudyMode }
  | { type: "level"; level: Level }
  | { type: "review" };

// 途中保存クイズセッション
export interface SavedSession {
  quizWordIds: string[];
  quizIsReview: boolean[];
  quizIsReviewToday: boolean[];
  currentIndex: number;
  results: QuizResult[];
  sessionInfo: SessionInfo;
  isReviewSession: boolean;
  savedAt: string;
}
