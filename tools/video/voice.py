# ミチシルベ ナレーション生成 (VOICEVOX) + 字幕SRT生成
# 前提: VOICEVOXアプリを起動しておく(エンジンが http://127.0.0.1:50021 で待受)
# 使い方: python3 tools/video/voice.py          → out/nar_S1_opening.wav ... と out/subs.srt
#         VOICE_SPEAKER=13 python3 tools/video/voice.py   (話者IDを変える。一覧は下のlist)
#         python3 tools/video/voice.py list      → 話者一覧を表示
import json, os, sys, urllib.request, urllib.parse, pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
ENGINE = os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021")
SPEAKER = int(os.environ.get("VOICE_SPEAKER", "13"))  # 13=青山龍星(落ち着いた男声)の環境が多い。listで確認
SPEED = float(os.environ.get("VOICE_SPEED", "1.0"))

def api(path, data=None, q=None):
    url = ENGINE + path + ("?" + urllib.parse.urlencode(q) if q else "")
    req = urllib.request.Request(url, data=data, method="POST" if data is not None or q else "GET")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

if len(sys.argv) > 1 and sys.argv[1] == "list":
    for s in json.loads(api("/speakers")):
        for st in s["styles"]:
            print(f'{st["id"]:>3}  {s["name"]} / {st["name"]}')
    sys.exit(0)

shots = json.loads((HERE / "shots.json").read_text(encoding="utf-8"))["shots"]

def fmt(t):
    h, t = divmod(t, 3600); m, s = divmod(t, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s % 1) * 1000):03d}"

srt, idx, t = [], 1, 0.0
for shot in shots:
    text = shot["nar"]
    print(f'{shot["id"]}: {len(text)}字 → 音声合成中...')
    query = json.loads(api("/audio_query", q={"text": text, "speaker": SPEAKER}, data=b""))
    query["speedScale"] = SPEED
    wav = api("/synthesis", q={"speaker": SPEAKER}, data=json.dumps(query).encode())
    (OUT / f'nar_{shot["id"]}.wav').write_bytes(wav)
    # 字幕: ナレ文を句点で割って、ショット尺に按分
    parts = [p + "。" for p in text.rstrip("。").split("。") if p]
    total = sum(len(p) for p in parts)
    cursor = t
    for p in parts:
        d = shot["dur"] * len(p) / total
        srt.append(f"{idx}\n{fmt(cursor)} --> {fmt(cursor + d - 0.05)}\n{p}\n")
        idx += 1; cursor += d
    t += shot["dur"]

(OUT / "subs.srt").write_text("\n".join(srt), encoding="utf-8")
print(f"\n完了: {OUT}/nar_*.wav と {OUT}/subs.srt")
print("※字幕の時刻はショット尺ベースの目安。編集で実際の音声長に合わせて微調整を")
