# StillMotion Studio 設計メモ

## 目的

「静止画 + 文章 + 音」を入力し、元絵の一貫性を壊さず、最小限の動きで映像として成立させる汎用システム。

用途は絵本に限定しない。

- 動く絵本
- 怪談 / ホラー紙芝居
- ゲームイベント映像
- キャラクター紹介PV
- 漫画・イラストPV
- 旅行記 / 解説動画
- 静止画MV

## 原則

1. フルAI動画生成を中核にしない
2. 元画像を最優先で保護する
3. 小さい動きは決定論的なレンダリングで作る
4. AIは「演出案を作る」「素材を必要時だけ生成する」役割
5. 音楽・TTS・画像動画モデルは Provider Adapter で交換可能にする

## Motion Levels

- L1: カメラ（パン / ズーム / フェード）
- L2: オーバーレイ（雨 / 雪 / 葉 / 光 / 風 / 煙）
- L3: 部分選択レイヤー（木、カーテン、水面だけ動かす）
- L4: キャラクター微動（呼吸 / まばたき / 耳 / 尻尾）
- L5: AI動画生成（必要な場面だけ）

## v0.1（現在）

- L1 / L2
- シーン管理
- 音声ファイル
- BGM
- 簡易自動演出
- JSON
- WebM出力

## v0.2

### 部分選択アニメーション

ユーザーが画像上をブラシ / 四角 / AI選択で指定:

- 木 → 揺らす
- カーテン → 揺らす
- 水面 → 波紋
- 雲 → 横移動
- 炎 → ゆらぎ
- キャラ → 呼吸

内部処理:

1. マスク作成
2. 対象レイヤー切り出し
3. 背景の穴をインペイント
4. レイヤーをTransform / Warp
5. 元画像と合成

「文字保護領域」も同じマスクシステムで扱う。

## v0.3

### AI演出監督

入力:
- 画像
- 読み上げ文章
- ジャンル / 雰囲気

出力:
- シーンタイプ
- 推奨秒数
- カメラ
- 動かす候補領域
- オーバーレイ
- 環境音
- BGMの強さ
- 無音にすべき間

AIの提案は `project.json` に落とし、人間が修正可能にする。

## 音の構成

- narration
- dialogue（将来）
- ambient
- sfx
- bgm

### 自動ダッキング

ナレーション中はBGMを20〜40%程度に落とし、終了後に戻す。

## Music Provider

```text
MusicProvider
├─ LocalFileProvider
├─ LicensedLibraryProvider
└─ AIGenerationProvider
```

特定サービス依存を避ける。

## TTS Provider

```text
TTSProvider
├─ BrowserPreviewTTS
├─ LocalTTS
└─ CloudTTS
```

## 本格レンダラ予定

- UI: React + TypeScript
- Timeline: 独自シーンモデル
- Renderer: Remotion
- Encode / mux: FFmpeg
- Project: JSON
- Desktop packaging候補: Tauri

## project.json 基本形

```json
{
  "title": "sample",
  "width": 1080,
  "height": 1440,
  "fps": 30,
  "scenes": [
    {
      "name": "rain scene",
      "image": "assets/09.webp",
      "narration": "雨が降ってきました。",
      "duration": 8.4,
      "textLock": true,
      "camera": "none",
      "effects": ["rain"],
      "effectStrength": 0.6
    }
  ]
}
```

## 『まると おともだち』で検証する機能

- 晴天 / 木漏れ日
- 室内静止
- 睡眠の静かな場面
- 雨
- 強風
- 森 / 葉
- ピクニック
- 落ち着いたエンディング

一冊でL1/L2の主要ケースが検証できる。
