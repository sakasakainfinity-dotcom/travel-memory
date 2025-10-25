'use client';
import { forwardRef, useImperativeHandle, useRef } from 'react';

type Props = {
  onPick: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  style?: React.CSSProperties;
};

export type SafeFilePickerRef = { open: () => void };

const SafeFilePicker = forwardRef<SafeFilePickerRef, Props>(function SafeFilePicker(
  { onPick, multiple = true, label = '写真を追加', style },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    open() {
      // 同じファイルを選び直しても change を発火させる
      if (inputRef.current) inputRef.current.value = '';
      inputRef.current?.click();
    },
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) inputRef.current.value = '';
          inputRef.current?.click();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #ddd',
          background: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          ...style,
        }}
      >
        {label}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => onPick(Array.from(e.target.files ?? []))}
        // 画面外＆不可視に（label重ね方式をやめて、click() で開く）
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
      />
    </>
  );
});

export default SafeFilePicker;
