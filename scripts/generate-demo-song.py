#!/usr/bin/env python3
"""Generate the original Mibemol.si demo song and its aligned MP3 stems."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import tempfile
import wave
import zipfile
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demo"
SAMPLE_RATE = 44_100
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 48
DURATION = BARS * BAR
RNG = np.random.default_rng(913042)

CHORDS = ["D", "F", "G", "D", "Bb", "C", "D", "D"]
ROOTS = {"D": 38, "F": 41, "G": 43, "Bb": 46, "C": 48}
POWER = {"D": [38, 45, 50], "F": [41, 48, 53], "G": [43, 50, 55],
         "Bb": [46, 53, 58], "C": [48, 55, 60]}


def midi_hz(note: float) -> float:
    return 440 * (2 ** ((note - 69) / 12))


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    alpha = 1 - math.exp(-2 * math.pi * cutoff / SAMPLE_RATE)
    out = np.empty_like(signal)
    prev = np.zeros(signal.shape[1], dtype=np.float32)
    for i in range(len(signal)):
        prev += alpha * (signal[i] - prev)
        out[i] = prev
    return out


def pan(mono: np.ndarray, pos: float) -> np.ndarray:
    angle = (pos + 1) * math.pi / 4
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle))).astype(np.float32)


def place(stem: np.ndarray, sound: np.ndarray, at: float) -> None:
    start = max(0, int(at * SAMPLE_RATE))
    end = min(len(stem), start + len(sound))
    if end > start:
        stem[start:end] += sound[:end - start]


def guitar_note(note: float, duration: float, velocity: float, pan_pos: float,
                palm_mute: bool = False) -> np.ndarray:
    n = max(1, int(duration * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    f = midi_hz(note)
    detune = 1.004
    wave1 = np.sin(2 * math.pi * f * t) + 0.48 * np.sin(4 * math.pi * f * t)
    wave1 += 0.24 * np.sin(6 * math.pi * f * t) + 0.12 * np.sin(8 * math.pi * f * t)
    wave2 = np.sin(2 * math.pi * f * detune * t + 0.08) + 0.42 * np.sin(4 * math.pi * f * detune * t)
    mono = 0.5 * (wave1 + wave2)
    attack = min(int(0.008 * SAMPLE_RATE), n)
    release = min(int((0.045 if palm_mute else 0.12) * SAMPLE_RATE), n)
    env = np.ones(n, dtype=np.float32)
    if attack:
        env[:attack] = np.linspace(0, 1, attack, dtype=np.float32)
    if release:
        env[-release:] *= np.linspace(1, 0, release, dtype=np.float32)
    if palm_mute:
        env *= np.exp(-np.arange(n, dtype=np.float32) / (0.055 * SAMPLE_RATE))
    mono = np.tanh(mono * (3.5 + velocity * 2.5)) * env * velocity * 0.22
    return pan(mono, pan_pos)


def bass_note(note: float, duration: float, velocity: float) -> np.ndarray:
    n = max(1, int(duration * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    f = midi_hz(note)
    mono = np.sin(2 * math.pi * f * t) + 0.5 * np.sin(4 * math.pi * f * t)
    mono += 0.22 * np.sign(np.sin(2 * math.pi * f * t))
    env = np.exp(-np.arange(n, dtype=np.float32) / (0.28 * SAMPLE_RATE))
    env = 0.25 + 0.75 * env
    attack = min(int(0.006 * SAMPLE_RATE), n)
    env[:attack] *= np.linspace(0, 1, attack, dtype=np.float32)
    mono = np.tanh(mono * 2.3) * env * velocity * 0.3
    return pan(mono, -0.06)


def kick() -> np.ndarray:
    n = int(0.48 * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    freq = 42 + 105 * np.exp(-t * 24)
    phase = 2 * math.pi * np.cumsum(freq) / SAMPLE_RATE
    body = np.sin(phase) * np.exp(-t * 10)
    click = RNG.normal(0, 1, n).astype(np.float32) * np.exp(-t * 120) * 0.11
    mono = np.tanh((body + click) * 1.7) * 0.8
    return np.column_stack((mono, mono)).astype(np.float32)


def snare() -> np.ndarray:
    n = int(0.32 * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    noise = RNG.normal(0, 1, n).astype(np.float32)
    body = np.sin(2 * math.pi * 185 * t) * np.exp(-t * 18)
    snap = noise * np.exp(-t * 23)
    mono = np.tanh((snap * 0.34 + body * 0.6) * 1.5) * 0.7
    return pan(mono, 0.02)


def hat(open_hat: bool = False) -> np.ndarray:
    dur = 0.22 if open_hat else 0.055
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n, dtype=np.float32) / SAMPLE_RATE
    noise = RNG.normal(0, 1, n).astype(np.float32)
    env = np.exp(-t * (22 if open_hat else 75))
    mono = noise * env * (0.13 if open_hat else 0.075)
    return pan(mono, 0.12)


def chord_for_bar(bar: int) -> str:
    section_bar = bar % 8
    return CHORDS[section_bar]


def rhythm_section() -> np.ndarray:
    stem = np.zeros((int(DURATION * SAMPLE_RATE), 2), dtype=np.float32)
    eighth = BEAT / 2
    # A syncopated low-register figure with different accents in verse and chorus.
    verse_pattern = [(0, 1), (0.75, 0.65), (1.5, 0.9), (2.25, 0.68), (3, 1)]
    chorus_pattern = [(0, 1), (0.5, 0.65), (1, 0.86), (2, 1), (2.5, 0.6), (3, 0.95)]
    for bar in range(BARS):
        chord = chord_for_bar(bar)
        bar_start = bar * BAR
        section = (bar // 8) % 6
        chorus = section in (2, 4, 5)
        pattern = chorus_pattern if chorus else verse_pattern
        if bar < 4:
            pattern = [(0, 0.8), (2, 0.6)]
        if 36 <= bar < 40:
            pattern = [(0, 1), (1.5, 0.7), (3, 0.9)]
        for beat, vel in pattern:
            at = bar_start + beat * BEAT
            mute = beat % 1 != 0 or not chorus
            for note_i, note in enumerate(POWER[chord]):
                # Open voicings and sustained chords keep the chorus lifting.
                dur = (eighth * 1.7 if chorus and beat % 1 == 0 else eighth * 0.82)
                if chorus and beat in (0, 2) and note_i:
                    dur = BEAT * 0.82
                place(stem, guitar_note(note + 12, dur, vel * (0.7 if note_i else 1),
                                        -0.55, palm_mute=mute), at)
    return stem


def lead_section() -> np.ndarray:
    stem = np.zeros((int(DURATION * SAMPLE_RATE), 2), dtype=np.float32)
    scale = [62, 65, 67, 69, 72, 74, 77]
    for bar in range(BARS):
        section = (bar // 8) % 6
        if section not in (2, 4, 5) and not (36 <= bar < 40):
            continue
        chord = chord_for_bar(bar)
        root = ROOTS[chord] + 24
        notes = [root + 12, root + 17, root + 19, root + 22, root + 24, root + 29, root + 31]
        if bar % 4 in (0, 3):
            sequence = [notes[2], notes[4], notes[3], notes[1]]
        elif bar % 4 == 1:
            sequence = [notes[4], notes[5], notes[4], notes[2]]
        else:
            sequence = [notes[1], notes[2], notes[4], notes[3]]
        start = bar * BAR
        for j, note in enumerate(sequence):
            at = start + j * BEAT + (0.12 * BEAT if j == 2 else 0)
            dur = BEAT * (0.72 if j < 3 else 1.35)
            # A tiny upward scoop gives the line an expressive, played feel.
            sound = guitar_note(note, dur, 0.65 if j else 0.85, 0.5)
            place(stem, sound, at)
        # Occasional held note at the end of each four-bar phrase.
        if bar % 4 == 3:
            place(stem, guitar_note(notes[4], BEAT * 1.7, 0.7, 0.56), start + BAR - BEAT * 0.25)
    return stem


def bass_section() -> np.ndarray:
    stem = np.zeros((int(DURATION * SAMPLE_RATE), 2), dtype=np.float32)
    pattern = [0, 0, 7, 0, 10, 7, 0, 7]
    for bar in range(BARS):
        root = ROOTS[chord_for_bar(bar)]
        section = (bar // 8) % 6
        chorus = section in (2, 4, 5)
        subdivision = BEAT / (2 if chorus else 1)
        count = 8 if chorus else 4
        for i in range(count):
            offset = pattern[i % len(pattern)]
            note = root + offset - 12
            vel = 0.9 if i in (0, 4) else 0.66
            place(stem, bass_note(note, subdivision * 0.88, vel), bar * BAR + i * subdivision)
    return stem


def drums_section() -> np.ndarray:
    stem = np.zeros((int(DURATION * SAMPLE_RATE), 2), dtype=np.float32)
    kick_s, snare_s, hat_s, open_hat_s = kick(), snare(), hat(), hat(True)
    for bar in range(BARS):
        start = bar * BAR
        section = (bar // 8) % 6
        chorus = section in (2, 4, 5)
        half_time = 36 <= bar < 40
        if bar >= 4:
            for beat in ([0, 2] if half_time else [0, 2, 2.75] if chorus else [0, 2.5]):
                place(stem, kick_s * (1.0 if beat == 0 else 0.82), start + beat * BEAT)
        for beat in ([1] if half_time else [1, 3]):
            place(stem, snare_s * (0.94 if chorus else 0.78), start + beat * BEAT)
        subdivisions = 8 if chorus else 4
        for i in range(subdivisions):
            at = start + i * (BEAT / (2 if chorus else 1))
            if bar < 4:
                if i % 2 == 0:
                    place(stem, hat_s * 0.75, at)
                continue
            velocity = (0.9 if i % 4 == 0 else 0.52) * (1.0 if chorus else 0.72)
            use_open = chorus and i in (3, 7)
            place(stem, (open_hat_s if use_open else hat_s) * velocity, at)
        if bar % 8 == 7:
            for j in range(4):
                place(stem, snare_s * (0.35 + 0.12 * j), start + 3 * BEAT + j * BEAT / 4)
    return stem


def write_wav(path: Path, audio: np.ndarray) -> None:
    audio = np.clip(audio, -1, 1)
    pcm = (audio * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(pcm.tobytes())


def encode_mp3(src: Path, dest: Path, bitrate: str) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
        "-codec:a", "libmp3lame", "-b:a", bitrate, "-ar", str(SAMPLE_RATE), str(dest)
    ], check=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    stems = {
        "drums": drums_section(),
        "bass": bass_section(),
        "rhythm-guitar": rhythm_section(),
        "lead-guitar": lead_section(),
    }
    mix = np.sum(np.stack(list(stems.values())), axis=0) * 0.62
    peaks = [float(np.max(np.abs(stem))) for stem in stems.values()]
    mix_peak = float(np.max(np.abs(mix)))
    scale = min(0.9 / max(peaks), 0.95 / max(mix_peak, 1e-9))
    for stem in stems.values():
        stem *= scale
    mix *= scale

    labels = [
        ("drums", "Batería"),
        ("bass", "Bajo"),
        ("rhythm-guitar", "Guitarra rítmica"),
        ("lead-guitar", "Guitarra líder"),
    ]
    with tempfile.TemporaryDirectory(prefix="mibemol-demo-") as temp_dir:
        temp = Path(temp_dir)
        for slug, _ in labels:
            wav_path = temp / f"{slug}.wav"
            write_wav(wav_path, stems[slug])
            encode_mp3(wav_path, OUT / f"cable-a-tierra-{slug}.mp3", "192k")
        mix_path = temp / "mix.wav"
        write_wav(mix_path, mix)
        encode_mp3(mix_path, OUT / "cable-a-tierra.mp3", "320k")

    project_id = "demo-cable-a-tierra"
    project = {
        "version": "demo",
        "id": project_id,
        "name": "Cable a Tierra — Demo",
        "bpm": BPM,
        "pitchSemitones": 0,
        "tempoRate": 1,
        "loopStart": None,
        "loopEnd": None,
        "playheadPosition": 0,
        "metronomeEnabled": False,
        "magnetEnabled": True,
        "countInBars": 0,
        "tracks": [
            {
                "name": label,
                "mute": False,
                "solo": False,
                "volume": 1,
                "kind": "audio",
                "clips": [{
                    "kind": "audio",
                    "fileName": f"Cable a Tierra — {label}.mp3",
                    "startPosition": 0,
                    "offsetSeconds": 0,
                    "id": f"{project_id}-{slug}",
                    "sourceStart": 0,
                    "duration": DURATION,
                    "audioFile": f"audio_{index}_0.mp3",
                }],
            }
            for index, (slug, label) in enumerate(labels)
        ],
    }
    archive = OUT / "cable-a-tierra.mibemolsi"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=3) as zf:
        zf.writestr("project.json", json.dumps(project, ensure_ascii=False, indent=2))
        for index, (slug, _) in enumerate(labels):
            zf.write(OUT / f"cable-a-tierra-{slug}.mp3", f"audio_{index}_0.mp3")

    (OUT / "cable-a-tierra.json").write_text(json.dumps({
        "title": "Cable a Tierra",
        "description": "Instrumental original de rock alternativo, compuesto y producido para Mibemol.si.",
        "bpm": BPM,
        "durationSeconds": round(DURATION, 3),
        "format": "MP3 320 kbps mix; aligned 192 kbps MP3 stems",
        "tracks": [label for _, label in labels],
        "credits": "Composición y producción original para Mibemol.si.",
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"Generated {DURATION:.1f}s song in {OUT}")
    for file in sorted(OUT.glob("cable-a-tierra*")):
        print(f"{file.name}: {file.stat().st_size / 1024 / 1024:.2f} MiB")


if __name__ == "__main__":
    main()
