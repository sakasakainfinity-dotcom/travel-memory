'use client';
import SafeFilePicker from '@/components/SafeFilePicker';
import { useState } from 'react';

export default function FileTest() {
  const [n, setN] = useState(0);
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>ファイル選択テスト</h1>
      <SafeFilePicker
        onPick={(files) => {
          setN(files.length);
          alert(`${files.length}枚えらべた`);
          console.log(files);
        }}
      />
      <div style={{ marginTop: 12 }}>選択枚数: {n}</div>
      <a href="/" style={{ display: 'inline-block', marginTop: 20, fontWeight: 800 }}>地図に戻る →</a>
    </main>
  );
}
