// ==========================================
// 例文表示パネル
// ボタンを押したときだけ表示します
// buttonLabel：ボタンのテキストを変えられます（ヒント用など）
// forceOpen：最初から開いた状態にします
// ==========================================

import { useState } from "react";
import type { Word } from "../types";
import { speakEnglish } from "../utils/speech";

interface Props {
  word: Word;
  buttonLabel?: string;  // デフォルトは「例文を見る」
  forceOpen?: boolean;   // trueなら最初から表示する
}

export const ExamplePanel = ({
  word,
  buttonLabel = "例文を見る",
  forceOpen = false,
}: Props) => {
  const [open, setOpen] = useState(forceOpen);
  const [showJa, setShowJa] = useState(false);

  const handleSpeakExample = () => {
    speakEnglish(word.exampleEn, 0.85);
  };

  if (!open) {
    return (
      <button className="btn-hint" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="example-panel">
      <p className="example-en">{word.exampleEn}</p>

      {showJa ? (
        <p className="example-ja">{word.exampleJa}</p>
      ) : (
        <button className="btn-show-ja" onClick={() => setShowJa(true)}>
          和訳を見る
        </button>
      )}

      <div className="example-actions">
        <button className="btn-secondary" onClick={handleSpeakExample}>
          例文を発音
        </button>
        <button className="btn-text" onClick={() => { setOpen(false); setShowJa(false); }}>
          閉じる
        </button>
      </div>
    </div>
  );
};
