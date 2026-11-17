# 説明動画の作り方(自動録画+AI音声)

台本の原本は `shots.json`。ここを直せば、録画も音声も字幕も作り直せる。

## 0. 準備(最初の1回だけ)

```bash
# ターミナルを開く(⌘+Space →「ターミナル」)
brew install node ffmpeg
cd ~/Downloads/michishirube
npm init -y
npm install playwright
npx playwright install chromium
```

VOICEVOX(無料のAI音声): https://voicevox.hiroshiba.jp/ からMac版をダウンロードして起動しておく(起動中はエンジンが裏で待ち受ける)。

報告アプリのシーン(S5)用に、ぼかし済みの現場写真を2枚置く:

```
tools/video/assets/sample_kinkei.jpg   (近景)
tools/video/assets/sample_enkei.jpg    (遠景)
```

## 1. 録画(S1〜S6の素材が自動で撮れる)

```bash
cd ~/Downloads/michishirube
node tools/video/record.mjs            # 全ショット
node tools/video/record.mjs S4_copy    # 1ショットだけ撮り直し
```

本物のクリック・強調枠・カーソルの動きつきで `tools/video/out/*.webm` に出る。mp4化:

```bash
for f in tools/video/out/*.webm; do ffmpeg -y -i "$f" "${f%.webm}.mp4"; done
```

## 2. ナレーション(AI音声)+字幕

VOICEVOXを起動した状態で:

```bash
python3 tools/video/voice.py list              # 話者一覧(IDを確認)
VOICE_SPEAKER=13 python3 tools/video/voice.py  # 13は落ち着いた男声の例。好みのIDに
```

`tools/video/out/` に `nar_S1_opening.wav` 等と `subs.srt` が出る。

## 3. 編集

CapCut(またはiMovie/Resolve)に mp4・wav・subs.srt を読み込んで、ショット順に並べる。
`shots.json` の `dur` がそのままタイムラインの目安。間を詰めて、数字テロップ(366件/56%/14.1件・日)だけ足す。

S1の冒頭0〜4秒とS6のラストに、実測写真のフラッシュとロゴ(歩歩歩 ミチシルベ+URL)を重ねると台本どおりの3分になる。

## 直したくなったら

- 言い回し → `shots.json` の `nar` を直して `voice.py` 再実行
- 画面の動き → `steps` を直して `record.mjs` 再実行(該当ショットだけでOK)
- デモ本体を更新したら → 録画し直すだけで新画面の素材になる

VOICEVOX利用時のクレジット表記(動画概要欄): `音声: VOICEVOX:青山龍星` のように使った話者名を記載。
