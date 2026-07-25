import { useState, useEffect, useCallback, useRef } from "react";
import type { QuizItem, QuizResult } from "../types";
import { speakEnglish, playCorrectSound, playWrongSound } from "../utils/speech";
import { ExamplePanel } from "./ExamplePanel";
import { words } from "../data/words";

interface Props {
  quizList: QuizItem[];
  onFinish: (results: QuizResult[]) => void;
  onHome: () => void;
  isReview?: boolean;
  audioOnlyMode?: boolean;
  startIndex?: number;
  initialResults?: QuizResult[];
  onSaveProgress?: (index: number, results: QuizResult[]) => void;
}

type AnswerState = "waiting" | "correct" | "wrong" | "dontknow";

interface Snapshot {
  results: QuizResult[];
  index: number;
}

export const QuizScreen = ({ quizList, onFinish, onHome, isReview = false, audioOnlyMode = false, startIndex = 0, initialResults = [], onSaveProgress }: Props) => {
  const [index, setIndex] = useState(startIndex);
  const [answerState, setAnswerState] = useState<AnswerState>("waiting");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [results, setResults] = useState<QuizResult[]>(initialResults);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showExampleAfterCorrect, setShowExampleAfterCorrect] = useState(false);
  const [showWrongLookup, setShowWrongLookup] = useState(false);

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResultRef = useRef<QuizResult | null>(null);

  // 進捗を自動保存（インデックスが進むたびに）
  useEffect(() => {
    if (onSaveProgress && index < quizList.length) {
      onSaveProgress(index, results);
    }
  }, [index, results]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = quizList[index];

  useEffect(() => {
    if (!current) return;
    setAnswerState("waiting");
    setSelectedIndex(null);
    setShowExampleAfterCorrect(false);
    setShowWrongLookup(false);
    setStartTime(Date.now());
    pendingResultRef.current = null;

    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

    const timer = setTimeout(() => {
      speakEnglish(current.word.pronunciationText);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [index, current]);

  const commitAndGoNext = useCallback(
    (finalResult: QuizResult) => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

      const newResults = [...results, finalResult];

      if (index + 1 >= quizList.length) {
        onFinish(newResults);
      } else {
        // 戻るボタン用にスナップショットを保存してから次へ進む
        setSnapshots((prev) => [...prev, { results: [...results], index }]);
        setResults(newResults);
        setIndex((i) => i + 1);
      }
    },
    [index, quizList.length, results, onFinish]
  );

  // 前の問題に戻る（スナップショットを復元）
  const handleBack = useCallback(() => {
    if (snapshots.length === 0) return;
    const last = snapshots[snapshots.length - 1];
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setSnapshots((prev) => prev.slice(0, -1));
    setResults(last.results);
    setIndex(last.index);
    setAnswerState("waiting");
    setSelectedIndex(null);
    setShowExampleAfterCorrect(false);
    pendingResultRef.current = null;
  }, [snapshots]);

  const handleSelect = useCallback(
    (choiceIndex: number) => {
      if (answerState !== "waiting") return;

      const elapsed = (Date.now() - startTime) / 1000;
      const slow = elapsed > 3;
      const correct = choiceIndex === current.word.correctChoiceIndex;

      setSelectedIndex(choiceIndex);
      setAnswerState(correct ? "correct" : "wrong");

      if (correct) playCorrectSound();
      else playWrongSound();

      const result: QuizResult = {
        wordId: current.word.id,
        correct,
        slow,
        uncertain: false,
      };
      pendingResultRef.current = result;
    },
    [answerState, current, startTime]
  );

  const handleDontKnow = useCallback(() => {
    if (answerState !== "waiting") return;

    setSelectedIndex(null);
    setAnswerState("dontknow");
    playWrongSound();

    const result: QuizResult = {
      wordId: current.word.id,
      correct: false,
      slow: false,
      uncertain: true,
    };
    pendingResultRef.current = result;
  }, [answerState, current]);

  const handleUncertain = useCallback(() => {
    if (!pendingResultRef.current) return;
    const uncertainResult: QuizResult = {
      ...pendingResultRef.current,
      uncertain: true,
    };
    commitAndGoNext(uncertainResult);
  }, [commitAndGoNext]);

  const handleShowExampleAfterCorrect = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setShowExampleAfterCorrect(true);
  }, []);

  const handleNext = useCallback(() => {
    if (!pendingResultRef.current) return;
    commitAndGoNext(pendingResultRef.current);
  }, [commitAndGoNext]);

  if (!current) {
    return <div className="screen">問題がありません</div>;
  }

  const progress = `${index + 1} / ${quizList.length}`;
  const progressPct = ((index + 1) / quizList.length) * 100;

  return (
    <div className="screen quiz-screen">

      {/* ===== 進捗バー ===== */}
      <div className="quiz-progress">
        <button
          className="btn-home-quiz"
          onClick={() => {
            if (window.confirm("ホームに戻りますか？\n続きはホーム画面から再開できます。")) {
              onHome();
            }
          }}
          title="ホームに戻る"
        >
          🏠
        </button>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="quiz-progress-text">{progress}</span>
        {isReview && <span className="review-tag">再履修</span>}
        {current.isReview && !isReview && <span className="review-tag">復習</span>}
      </div>

      {/* ===== 単語表示エリア ===== */}
      <div className="word-area">
        {audioOnlyMode && answerState === "waiting" ? (
          <div className="audio-only-display">
            <div className="audio-only-icon">🔊</div>
            <p className="audio-only-label">音声を聞いて意味を選んでください</p>
          </div>
        ) : (
          <>
            <div className="word-display">{current.word.word}</div>
            <div className="word-meta">
              <span className="part-of-speech">{current.word.partOfSpeech}</span>
              <span className="level-tag">{current.word.level}</span>
            </div>
          </>
        )}
        <button
          className="btn-speak"
          onClick={() => speakEnglish(current.word.pronunciationText)}
        >
          🔊 もう一度発音
        </button>
      </div>

      {/* ===== 回答前：ヒント例文 ===== */}
      {answerState === "waiting" && (
        <div className="hint-area">
          <ExamplePanel
            key={`hint-${current.word.id}`}
            word={current.word}
            buttonLabel="💡 ヒントを見る（例文）"
          />
        </div>
      )}

      {/* ===== 回答後のフィードバック ===== */}
      {answerState === "correct" && (
        <div className="feedback correct-feedback">✓ 正解！</div>
      )}
      {answerState === "wrong" && (
        <div className="feedback wrong-feedback">
          ✗ 不正解。正解：{current.word.choices[current.word.correctChoiceIndex]}
        </div>
      )}
      {answerState === "dontknow" && (
        <div className="feedback dontknow-feedback">
          🤷 わからなかったね。正解：{current.word.choices[current.word.correctChoiceIndex]}
        </div>
      )}

      {/* ===== 4択ボタン ===== */}
      <div className="choices-grid">
        {current.word.choices.map((choice, i) => {
          let cls = "choice-btn";
          if (answerState !== "waiting") {
            if (i === current.word.correctChoiceIndex) cls += " correct";
            else if (i === selectedIndex && answerState === "wrong") cls += " wrong";
            else cls += " disabled";
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => handleSelect(i)}
              disabled={answerState !== "waiting"}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* ===== わからないボタン（回答前のみ） ===== */}
      {answerState === "waiting" && (
        <button className="btn-dontknow" onClick={handleDontKnow}>
          🤷 わからない
        </button>
      )}

      {/* ===== 不正解3択の英語逆引き（回答後・正解不正解どちらでも表示） ===== */}
      {answerState !== "waiting" && (() => {
        const lookups = current.word.choices
          .map((choice, i) => ({
            choice,
            en: i !== current.word.correctChoiceIndex
              ? words.find(w => w.meaning === choice)?.word
              : undefined,
          }))
          .filter(item => item.en);
        if (lookups.length === 0) return null;
        return showWrongLookup ? (
          <div className="choices-lookup-area">
            {lookups.map(({ choice, en }) => (
              <div key={choice} className="choices-lookup-row">
                <span className="choices-lookup-ja">{choice}</span>
                <span className="choices-lookup-sep">→</span>
                <strong className="choices-lookup-en">{en}</strong>
              </div>
            ))}
          </div>
        ) : (
          <button className="btn-choices-lookup-toggle" onClick={() => setShowWrongLookup(true)}>
            他の選択肢の英語を見る
          </button>
        );
      })()}

      {/* ===== 正解後のアクション ===== */}
      {answerState === "correct" && (
        <div className="after-answer-area">
          {showExampleAfterCorrect && (
            <ExamplePanel
              key={`example-${current.word.id}`}
              word={current.word}
              forceOpen
            />
          )}
          <div className="correct-action-row">
            <button className="btn-uncertain" onClick={handleUncertain}>
              🤔 不確か
            </button>
            {!showExampleAfterCorrect && (
              <button className="btn-hint small" onClick={handleShowExampleAfterCorrect}>
                例文を見る
              </button>
            )}
          </div>
          <button className="btn-next" onClick={handleNext}>
            次へ →
          </button>
        </div>
      )}

      {/* ===== 不正解・わからない後のアクション ===== */}
      {(answerState === "wrong" || answerState === "dontknow") && (
        <div className="wrong-actions">
          <ExamplePanel
            key={`example-${current.word.id}`}
            word={current.word}
          />
          <button className="btn-next" onClick={handleNext}>
            次へ →
          </button>
        </div>
      )}

      {/* ===== 戻るボタン（左下固定・全状態で表示） ===== */}
      {snapshots.length > 0 && (
        <div className="back-btn-area">
          <button className="btn-back" onClick={handleBack}>
            ← 1つ前に戻る
          </button>
        </div>
      )}

    </div>
  );
};
