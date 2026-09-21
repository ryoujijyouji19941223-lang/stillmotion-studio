# StillMotion Studio 設計

## 1. 目的

「静止画 + 文章 + 音」を入力し、元絵の一貫性を壊さず、最小限の動きで映像として成立させる汎用システムを作る。

想定用途は、動く絵本、怪談・ホラー紙芝居、ゲームイベント映像、キャラクター紹介PV、漫画・イラストPV、旅行記、解説動画、静止画MV。

## 2. 守る原則

1. 元画像を完成品として尊重する。
2. フルAI動画生成を必須にしない。
3. 同じ入力なら同じ結果になる決定論的な描画を優先する。
4. AIは演出案や選択補助として使い、人が修正できる状態を保つ。
5. 音楽・TTS・画像処理サービスは交換可能にする。
6. v0.1のプロジェクトはv0.2以降でも読み込めるようにする。

## 3. Motion Levels

| レベル | 内容 | 状況 |
| --- | --- | --- |
| L1 | カメラのパン、ズーム、フェード | v0.1で試作済み |
| L2 | 雨、雪、葉、光などのオーバーレイ | v0.1で試作済み |
| L3 | 木、カーテン、水面などの部分選択レイヤー | v0.2で実装 |
| L4 | 呼吸、まばたき、耳、尻尾などのキャラクター微動 | L3の後に検証 |
| L5 | 必要な場面だけAI動画生成 | 将来候補 |

## 4. 現在の構成

v0.1は依存ライブラリなしのHTML/CSS/JavaScriptで動く。v0.2プレビューもこの構成を維持し、`app.js` がシーン管理、Canvas描画、範囲選択、音声プレビュー、WebM書き出しを担当する。データの正規化、座標変換、Transform計算は `src/v0.2/partial-motion.mjs` へ分離した。

この形は試作には速いが、部分モーションを直接足すと責務が集中する。そのためv0.2では、既存処理をすぐ書き換えず、次の境界を先に作る。

| 責務 | 入力 | 出力 |
| --- | --- | --- |
| Project Model | JSON | 正規化済みプロジェクト |
| Mask Editor | 四角選択、自由選択、追加・削除ブラシ、画像座標 | マスクデータ |
| Layer Extractor | 元画像、マスク | 前景レイヤー、背景 |
| Motion Evaluator | モーション設定、時刻 | Transform値 |
| Compositor | 背景、レイヤー、Transform | 1フレーム |
| Audio Mixer | ナレーション、環境音、BGM | 音声トラック |
| Exporter | フレーム、音声 | WebM / 将来MP4 |

## 5. プロジェクト形式

ルートには `formatVersion` を置く。v0.1由来のデータでこの値がない場合は `1` として扱う。

```json
{
  "formatVersion": 1,
  "title": "sample",
  "width": 1080,
  "height": 1440,
  "fps": 30,
  "scenes": []
}
```

v0.2のシーンには、省略可能な `motionRegions` と `imageFit` を追加する。空配列または未指定ならv0.1と同じ描画になる。`imageFit` は `cover`（画面を埋めて端を切る）または `contain`（全体表示＋ぼかし背景）を使う。

```json
{
  "name": "雨上がりの木",
  "image": "assets/tree.webp",
  "duration": 8,
  "camera": "none",
  "textLock": true,
  "effects": ["rain"],
  "motionRegions": [
    {
      "id": "tree-canopy",
      "name": "木の葉",
      "enabled": true,
      "mask": {
        "kind": "paint",
        "width": 1080,
        "height": 1440,
        "source": "masks/tree-canopy.png",
        "feather": 12,
        "invert": false
      },
      "motion": {
        "type": "sway",
        "amplitude": 0.35,
        "speed": 0.45,
        "phase": 0,
        "axis": "x",
        "pivot": { "x": 0.5, "y": 1 }
      }
    }
  ]
}
```

詳細な決定事項は [PARTIAL_MOTION.md](PARTIAL_MOTION.md) を参照する。

## 6. v0.2の描画順

1. 元画像をCanvasへ収まるように配置する。
2. 背景の穴埋め済み画像を描く。
3. 各 `motionRegion` の時刻ごとのTransformを計算する。
4. マスク済み前景レイヤーをTransformして重ねる。
5. 雨や光などのL2効果を重ねる。
6. プレビューまたは動画書き出しへ渡す。

自由選択は元画像座標の点列を `mask.points` に保存する。追加・削除ブラシは `mask.strokes` にモード、太さ、点列を保存する。表示サイズが変わっても輪郭がずれないよう、Canvas座標のまま保存しない。

編集履歴はプロジェクトのスナップショットを最大50件までメモリに保持する。画像・音声ファイル本体は履歴JSONへ複製せず、シーンIDごとの実行時参照を引き継ぐ。

最初の実装では背景の自動インペイントを必須にしない。小さな揺れとマスクの余白で破綻を抑え、必要な場合だけ手動背景画像を指定できるようにする。

## 7. 音の構成

- `narration`: 読み上げ
- `dialogue`: 台詞（将来）
- `ambient`: 雨、風、室内音
- `sfx`: 単発効果音
- `bgm`: 全体音楽

各シーンに `narrationVolume`、`ambientVolume`、`ambientDuration` を持たせ、音声の種類ごとに音量と再生時間を分離する。

ナレーション中はBGMを20〜40%程度へ下げ、終了後に戻す。音声ファイルはプロジェクトJSONに埋め込まず、相対パスまたは利用時に選択したローカルファイルとして扱う。

## 8. 将来のアダプター境界

```text
MusicProvider
├─ LocalFileProvider
├─ LicensedLibraryProvider
└─ AIGenerationProvider

TTSProvider
├─ BrowserPreviewTTS
├─ LocalTTS
└─ CloudTTS
```

特定サービスの仕様や料金変更で作品データが使えなくならないよう、プロジェクト形式にはサービス固有IDを必須にしない。

## 9. 本格版の候補

- UI: React + TypeScript
- Timeline: 独自シーンモデル
- Renderer: Remotion
- Encode / mux: FFmpeg
- Desktop package: Tauri

ただし、v0.2の部分モーション検証は現行Canvas版で先に行う。実際に必要な操作が固まる前に全面移行しない。

## 10. 『まると おともだち』で検証すること

- 文字入りページを動かしても読めること
- 晴天、室内、睡眠、雨、強風、森、ピクニック、静かな結末の差
- 木や草だけを揺らす場面
- 風で小物が動く場面
- 動かさない方が良い場面を明示的に固定できること
- 18ページを通した保存、再読込、書き出し
