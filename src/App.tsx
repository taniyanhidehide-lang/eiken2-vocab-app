import { useState, useCallback } from "react";
import type { Screen, StudyMode, QuizResult, StudyRecord, QuizItem, Level, SessionInfo, SavedSession } from "./types";
import { HomeScreen } from "./components/HomeScreen";
import { QuizScreen } from "./components/QuizScreen";
import { ResultScreen } from "./components/ResultScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { ParentView } from "./components/ParentView";
import {
  loadRecord, saveRecord, updateStreak,
  recordCorrect, recordUncertain, recordWrong, recordFinalStageMiss,
  addToReviewToday, checkLevelUp,
  saveQuizSession, loadQuizSession, clearQuizSession,
  ensureWordStat, getTodayString,
} from "./utils/storage";
import {
  buildQuizList, buildQuizByLevel, buildReviewTodayList,
  handleCorrectAnswer, handleWrongAnswer,
  buildFinalStageList, buildFinalStagePrevDayWrongList, buildFinalStageFourDayReviewList,
} from "./utils/quiz";
import { syncToFirebase } from "./utils/sync";
import { computeAchievements } from "./utils/achievements";
import { applyAutoDailyTargets } from "./utils/pacing";
import { words } from "./data/words";
import "./App.css";

const LEVELS: Level[] = ["入門", "初級", "中級", "上級", "最上級"];

const SESSION_MODE_LABELS: Record<StudyMode, string> = {
  today: "未履修単語",
  uncleared: "本日未クリア",
  prevDayWrong: "前日間違え",
  fourDayReview: "4日後復習",
  finalStage1: "FSステージ1",
  finalStage2: "FSステージ2",
  finalStage3: "FSステージ3",
  finalStagePrevDayWrong: "FS前日間違え",
  finalStageFourDayReview: "FS4日後復習",
};

function App() {
  const [parentCode] = useState<string | null>(() => {
    const m = window.location.pathname.match(/^\/parent\/([A-Z0-9]{6})$/i);
    return m ? m[1].toUpperCase() : null;
  });

  const [screen, setScreen] = useState<Screen>("home");
  const [record, setRecord] = useState<StudyRecord>(() => {
    const rec = applyAutoDailyTargets(loadRecord());
    saveRecord(rec);
    return rec;
  });
  const [quizList, setQuizList] = useState<QuizItem[]>([]);
  const [sessionResults, setSessionResults] = useState<QuizResult[]>([]);
  const [isReviewSession, setIsReviewSession] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({ type: "mode", mode: "today" });
  const [quizStartIndex, setQuizStartIndex] = useState(0);
  const [quizInitialResults, setQuizInitialResults] = useState<QuizResult[]>([]);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => loadQuizSession());

  const handleStart = useCallback(
    (mode: StudyMode) => {
      const rec = { ...record };
      updateStreak(rec);

      // ファイナルステージは専用ビルダーを使用
      let list;
      if (mode === "finalStage1") list = buildFinalStageList(rec, 1, rec.sessionLength);
      else if (mode === "finalStage2") list = buildFinalStageList(rec, 2, rec.sessionLength);
      else if (mode === "finalStage3") list = buildFinalStageList(rec, 3, rec.sessionLength);
      else if (mode === "finalStagePrevDayWrong") list = buildFinalStagePrevDayWrongList(rec, rec.sessionLength);
      else if (mode === "finalStageFourDayReview") list = buildFinalStageFourDayReviewList(rec, rec.sessionLength);
      else list = buildQuizList(rec, mode, rec.sessionLength);

      if (list.length === 0) {
        const msgs: Record<StudyMode, string> = {
          uncleared:     "本日間違えた未クリア単語はありません。",
          prevDayWrong:  "前日以前に間違えた未クリア単語はありません。",
          fourDayReview: "4日後復習対象の単語はありません。",
          today:         "未履修の単語がありません。未クリア問題をお試しください。",
          finalStage1:   "ファイナルステージ1の対象単語がありません。",
          finalStage2:   "ファイナルステージ2の対象単語がありません。",
          finalStage3:   "ファイナルステージ3の対象単語がありません。",
          finalStagePrevDayWrong:  "ファイナルステージの前日以前に間違えた単語はありません。",
          finalStageFourDayReview: "ファイナルステージの4日後復習対象の単語はありません。",
        };
        alert(msgs[mode]);
        return;
      }
      clearQuizSession(); setSavedSession(null);
      setRecord(rec); saveRecord(rec);
      setQuizList(list); setSessionResults([]);
      setIsReviewSession(false); setLeveledUp(false);
      setSessionInfo({ type: "mode", mode });
      setQuizStartIndex(0); setQuizInitialResults([]);
      setScreen("quiz");
    },
    [record]
  );

  const handleQuizFinish = useCallback(
    (results: QuizResult[]) => {
      const beforeAchievements = computeAchievements(record);
      const rec = { ...record };
      const finalStageMode =
        sessionInfo.type === "mode" &&
        (sessionInfo.mode === "finalStage1" || sessionInfo.mode === "finalStage2" || sessionInfo.mode === "finalStage3" ||
         sessionInfo.mode === "finalStagePrevDayWrong" || sessionInfo.mode === "finalStageFourDayReview")
          ? sessionInfo.mode
          : null;

      for (const result of results) {
        const quizItem = quizList.find(q => q.word.id === result.wordId);
        if (!quizItem) continue;

        if (finalStageMode) {
          // ファイナルステージ（本編・FS前日復習・FS4日後復習）は正解のみ通常のクリア処理を行う。
          // 不正解/不確かでも入門〜最上級のクリア状態や本日の復習キューは巻き戻さない。
          const isMain = finalStageMode === "finalStage1" || finalStageMode === "finalStage2" || finalStageMode === "finalStage3";
          if (result.correct && !result.uncertain) {
            recordCorrect(rec, result.wordId);
            if (isMain) {
              ensureWordStat(rec, result.wordId).finalStageClearedDate = getTodayString();
            } else if (finalStageMode === "finalStagePrevDayWrong") {
              // FS前日復習で正解 → finalStagePrevDayCorrectDate = 今日（4日後に再出題）
              ensureWordStat(rec, result.wordId).finalStagePrevDayCorrectDate = getTodayString();
            } else {
              // FS4日後復習で正解 → 次の4日後サイクルへ
              ensureWordStat(rec, result.wordId).finalStagePrevDayCorrectDate = getTodayString();
            }
          } else {
            recordFinalStageMiss(rec, result.wordId);
            if (isMain) {
              ensureWordStat(rec, result.wordId).finalStageClearedDate = "";
            } else {
              // FS前日復習/FS4日後復習で不正解 → FS前日間違えサイクルに戻す
              ensureWordStat(rec, result.wordId).finalStagePrevDayCorrectDate = "";
            }
          }
          continue;
        }

        if (result.uncertain) {
          // 不確か＝間違いと同じ扱い
          recordUncertain(rec, result.wordId);
          addToReviewToday(rec, result.wordId);
          if (quizItem.isReview) {
            // 4日後復習で不確か → prevDayCorrectDate をクリア（前日間違えサイクルに戻る）
            ensureWordStat(rec, result.wordId).prevDayCorrectDate = "";
          }
        } else if (result.correct) {
          recordCorrect(rec, result.wordId);
          handleCorrectAnswer(rec, result.wordId, quizItem.isReviewToday, quizItem.isReview, quizItem.isPrevDayReview);
        } else {
          recordWrong(rec, result.wordId);
          handleWrongAnswer(rec, result.wordId, quizItem.isReviewToday);
          if (quizItem.isReview) {
            // 4日後復習で不正解 → prevDayCorrectDate をクリア（前日間違えサイクルに戻る）
            ensureWordStat(rec, result.wordId).prevDayCorrectDate = "";
          }
        }
      }

      // レベルアップ判定
      let didLevelUp = false;
      const currentIdx = LEVELS.indexOf(rec.currentLevel);
      if (currentIdx < LEVELS.length - 1) {
        const currentLevelWordIds = words.filter(w => w.level === rec.currentLevel).map(w => w.id);
        if (checkLevelUp(rec, currentLevelWordIds)) {
          rec.currentLevel = LEVELS[currentIdx + 1];
          didLevelUp = true;
        }
      }

      const finalRec = applyAutoDailyTargets(rec, didLevelUp);

      // 新しく獲得した称号を検出し、保護者ビューへの通知に含める
      const afterAchievements = computeAchievements(finalRec);
      const newlyEarned = afterAchievements
        .filter(a => a.earned && !beforeAchievements.find(b => b.id === a.id)?.earned)
        .map(({ emoji, label }) => ({ emoji, label }));

      setRecord(finalRec); saveRecord(finalRec);
      syncToFirebase(finalRec, newlyEarned);
      clearQuizSession(); setSavedSession(null);
      setSessionResults(results);
      setLeveledUp(didLevelUp);
      setScreen("result");
    },
    [record, quizList, sessionInfo]
  );

  const handleReview = useCallback(() => {
    const reviewList = buildReviewTodayList(record);
    if (reviewList.length === 0) { setScreen("home"); return; }
    clearQuizSession(); setSavedSession(null);
    setQuizList(reviewList); setSessionResults([]);
    setIsReviewSession(true); setLeveledUp(false);
    setSessionInfo({ type: "review" });
    setQuizStartIndex(0); setQuizInitialResults([]);
    setScreen("quiz");
  }, [record]);

  const handleStartByLevel = useCallback(
    (level: Level) => {
      const rec = { ...record };
      updateStreak(rec);
      const list = buildQuizByLevel(rec, level, rec.sessionLength);
      if (list.length === 0) { alert(`${level}レベルの単語がありません。`); return; }
      clearQuizSession(); setSavedSession(null);
      setRecord(rec); saveRecord(rec);
      setQuizList(list); setSessionResults([]);
      setIsReviewSession(false); setLeveledUp(false);
      setSessionInfo({ type: "level", level });
      setQuizStartIndex(0); setQuizInitialResults([]);
      setScreen("quiz");
    },
    [record]
  );

  // クイズ途中の進捗を保存するコールバック（QuizScreen から毎問呼ばれる）
  const handleSaveProgress = useCallback(
    (index: number, results: QuizResult[]) => {
      const session: SavedSession = {
        quizWordIds: quizList.map(q => q.word.id),
        quizIsReview: quizList.map(q => q.isReview),
        quizIsReviewToday: quizList.map(q => q.isReviewToday),
        currentIndex: index,
        results,
        sessionInfo,
        isReviewSession,
        savedAt: new Date().toISOString(),
      };
      saveQuizSession(session);
    },
    [quizList, sessionInfo, isReviewSession]
  );

  // 途中保存セッションから再開
  const handleResume = useCallback(() => {
    const session = savedSession;
    if (!session) return;
    const list: QuizItem[] = session.quizWordIds
      .map((id, i) => {
        const word = words.find(w => w.id === id);
        if (!word) return null;
        return { word, isReview: session.quizIsReview[i] ?? false, isReviewToday: session.quizIsReviewToday[i] ?? false };
      })
      .filter(Boolean) as QuizItem[];
    if (list.length === 0) { clearQuizSession(); setSavedSession(null); return; }
    setQuizList(list);
    setSessionResults([]);
    setIsReviewSession(session.isReviewSession);
    setLeveledUp(false);
    setSessionInfo(session.sessionInfo);
    setQuizStartIndex(session.currentIndex);
    setQuizInitialResults(session.results);
    setScreen("quiz");
  }, [savedSession]);

  // 途中保存を破棄
  const handleClearSession = useCallback(() => {
    clearQuizSession();
    setSavedSession(null);
  }, []);

  // 「次の問題へ」：同じセッション情報で再スタート
  const handleStartNext = useCallback(() => {
    if (sessionInfo.type === "mode") handleStart(sessionInfo.mode);
    else if (sessionInfo.type === "level") handleStartByLevel(sessionInfo.level);
    else handleReview();
  }, [sessionInfo, handleStart, handleStartByLevel, handleReview]);

  const handleSetTestDate        = useCallback((date: string) => { const rec = { ...record, testDate: date }; setRecord(rec); saveRecord(rec); }, [record]);
  const handleSetClearTargetDate = useCallback((date: string) => {
    const rec = applyAutoDailyTargets({ ...record, clearTargetDate: date }, true);
    setRecord(rec); saveRecord(rec);
  }, [record]);
  const handleToggleAudioMode    = useCallback(() => { const rec = { ...record, audioOnlyMode: !record.audioOnlyMode }; setRecord(rec); saveRecord(rec); }, [record]);
  const handleSetSessionLength   = useCallback((n: number) => { const rec = { ...record, sessionLength: n }; setRecord(rec); saveRecord(rec); }, [record]);
  const handleSetDailyNewTarget  = useCallback((n: number) => { const rec = { ...record, dailyNewTarget: n }; setRecord(rec); saveRecord(rec); }, [record]);
  const handleSetDailyClearTarget= useCallback((n: number) => { const rec = { ...record, dailyClearTarget: n }; setRecord(rec); saveRecord(rec); }, [record]);

  const handleResetLevels = useCallback((levelsToReset: Level[]) => {
    const levelSet = new Set(levelsToReset);
    const idsToDelete = new Set(words.filter(w => levelSet.has(w.level)).map(w => w.id));
    const newWordStats = { ...record.wordStats };
    for (const id of idsToDelete) delete newWordStats[id];
    const newRecord: StudyRecord = {
      ...record,
      wordStats: newWordStats,
      learnedWordIds: record.learnedWordIds.filter(id => !idsToDelete.has(id)),
    };
    setRecord(newRecord); saveRecord(newRecord);
  }, [record]);

  const handleHome = useCallback(() => {
    setScreen("home");
    const rec = applyAutoDailyTargets(loadRecord());
    saveRecord(rec);
    setRecord(rec);
    setSavedSession(loadQuizSession()); // クイズ中断時に保存された内容を反映
  }, []);

  if (parentCode) {
    return (
      <div className="app-container">
        <ParentView shareCode={parentCode} />
      </div>
    );
  }

  const savedSessionLabel = savedSession
    ? (() => {
        const si = savedSession.sessionInfo;
        const mode =
          si.type === "mode"   ? SESSION_MODE_LABELS[si.mode] :
          si.type === "level"  ? `${si.level}レベル練習` : "再履修";
        return `${mode}（${savedSession.currentIndex}/${savedSession.quizWordIds.length}問）`;
      })()
    : null;

  return (
    <div className="app-container">
      {screen === "home" && (
        <HomeScreen
          record={record}
          onStart={handleStart}
          onStartByLevel={handleStartByLevel}
          onOpenSettings={() => setScreen("settings")}
          onResetLevels={handleResetLevels}
          savedSessionLabel={savedSessionLabel}
          onResume={handleResume}
          onClearSession={handleClearSession}
        />
      )}
      {screen === "quiz" && (
        <QuizScreen
          quizList={quizList}
          onFinish={handleQuizFinish}
          onHome={handleHome}
          isReview={isReviewSession}
          audioOnlyMode={record.audioOnlyMode}
          startIndex={quizStartIndex}
          initialResults={quizInitialResults}
          onSaveProgress={handleSaveProgress}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          results={sessionResults}
          record={record}
          onReview={handleReview}
          onHome={handleHome}
          onStartNext={handleStartNext}
          hasReviewToday={record.reviewToday.length > 0}
          leveledUp={leveledUp}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen
          record={record}
          onBack={() => setScreen("home")}
          onSetTestDate={handleSetTestDate}
          onSetClearTargetDate={handleSetClearTargetDate}
          onToggleAudioMode={handleToggleAudioMode}
          onSetSessionLength={handleSetSessionLength}
          onSetDailyNewTarget={handleSetDailyNewTarget}
          onSetDailyClearTarget={handleSetDailyClearTarget}
        />
      )}
    </div>
  );
}

export default App;
