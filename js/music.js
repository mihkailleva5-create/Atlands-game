/**
 * Atlands — музыкальный движок.
 *
 * Музыка генерируется WebAudio прямо в игре: не нужны mp3-файлы,
 * нет авторских прав, нет веса и загрузки в Telegram — а треков много.
 * Каждый трек: своя аккордовая прогрессия, мелодия, темп, тембр и бас.
 *
 * Свои mp3 тоже можно добавить: положи файл в assets/music/
 * и впиши его в EXTERNAL_TRACKS ниже — он появится в плейлисте.
 */
'use strict';

/** Свои файлы: { title, emoji, desc, file: 'assets/music/my-track.mp3' } */
const EXTERNAL_TRACKS = [
  // { title: 'Мой трек', emoji: '🎵', desc: 'Файл из assets/music', file: 'assets/music/example.mp3' },
];

const NOTE = m => 440 * Math.pow(2, (m - 69) / 12); // midi -> Гц

/**
 * Синтезируемые треки. chords — аккорды в midi (бас + 3 ноты),
 * melody — ступени пентатоники по восьмым нотам (null = пауза).
 */
const SYNTH_TRACKS = [
  { title: 'Утренний остров', emoji: '🌅', desc: 'Тёплая мажорная тема для начала дня', bpm: 76, wave: 'sine',
    chords: [[48, 52, 55, 59], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]],
    melody: [7, null, 9, 11, null, 9, 7, null, 5, null, 7, 9, null, null, 4, null] },
  { title: 'Океанский бриз', emoji: '🌊', desc: 'Спокойные волны и мягкий бриз', bpm: 66, wave: 'triangle',
    chords: [[45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 54], [45, 48, 52, 55]],
    melody: [11, null, null, 9, null, 7, null, null, 9, null, 7, 5, null, null, null, null] },
  { title: 'Лесной ручей', emoji: '🌿', desc: 'Лёгкая тема для прогулок между деревьями', bpm: 88, wave: 'sine',
    chords: [[50, 53, 57, 60], [46, 50, 53, 58], [48, 51, 55, 58], [45, 48, 52, 55]],
    melody: [7, 9, 11, 9, 7, 5, 7, null, 9, 11, 12, 11, 9, 7, null, null] },
  { title: 'Закатные облака', emoji: '🌇', desc: 'Мечтательная мелодия золотого часа', bpm: 72, wave: 'triangle',
    chords: [[46, 50, 53, 57], [44, 48, 51, 55], [41, 45, 48, 52], [43, 47, 50, 53]],
    melody: [9, null, 11, null, 9, 7, null, 5, null, 7, null, 9, null, null, 11, null] },
  { title: 'Ночные звёзды', emoji: '🌌', desc: 'Медленный эмбиент для ночного острова', bpm: 56, wave: 'sine',
    chords: [[45, 48, 52, 59], [43, 47, 50, 57], [41, 45, 48, 53], [40, 44, 47, 52]],
    melody: [11, null, null, null, 9, null, null, null, 7, null, null, 9, null, null, null, null] },
  { title: 'Дождик и уют', emoji: '🌧️', desc: 'Тёплый лоу-фай под шум дождя', bpm: 68, wave: 'triangle',
    chords: [[48, 51, 55, 58], [46, 50, 53, 57], [44, 48, 51, 55], [43, 47, 50, 54]],
    melody: [7, null, 7, 9, null, null, 5, null, 7, null, null, 4, null, 5, null, null] },
  { title: 'Танец светлячков', emoji: '✨', desc: 'Игривая ночная тема со звоном', bpm: 96, wave: 'square',
    chords: [[47, 50, 54, 57], [45, 48, 52, 55], [43, 47, 50, 54], [45, 48, 52, 55]],
    melody: [11, 9, 11, 12, 11, 9, 7, 9, 11, null, 12, 11, 9, null, 7, null] },
  { title: 'Праздник Атланда', emoji: '🎉', desc: 'Бодрый финальный трек острова', bpm: 104, wave: 'triangle',
    chords: [[48, 52, 55, 59], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]],
    melody: [7, 7, 9, 11, 12, 11, 9, 7, 9, 9, 11, 12, 14, 12, 11, null] },
];

const MUSIC_TRACKS = [...SYNTH_TRACKS, ...EXTERNAL_TRACKS];

class MusicEngine {
  constructor() {
    this.ctx = null; this.master = null; this.timer = null;
    this.index = 0; this.playing = false; this.volume = 0.5;
    this.step = 0; this.nextTime = 0;
    this.audioEl = null; // для внешних mp3
    this.onChange = null; // (index, playing) => UI
  }

  get track() { return MUSIC_TRACKS[this.index]; }

  _ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.5;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 4200;
    this.master.connect(filter); filter.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.volume * 0.5;
    if (this.audioEl) this.audioEl.volume = this.volume;
  }

  play(index = this.index) {
    this._ensureCtx();
    this.stopScheduler();
    if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
    this.index = ((index % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const t = this.track;
    if (t.file) { // внешний mp3
      this.audioEl = new Audio(t.file);
      this.audioEl.loop = true; this.audioEl.volume = this.volume;
      this.audioEl.play().catch(() => {});
    } else if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.step = 0; this.nextTime = this.ctx.currentTime + 0.06;
      this.timer = setInterval(() => this._schedule(), 90);
    }
    this.playing = true;
    this._notify();
  }

  pause() {
    this.stopScheduler();
    if (this.audioEl) this.audioEl.pause();
    this.playing = false;
    this._notify();
  }

  toggle() { this.playing ? this.pause() : this.play(this.index); }
  next() { this.play(this.index + 1); }
  prev() { this.play(this.index - 1); }

  stopScheduler() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  _notify() { if (this.onChange) this.onChange(this.index, this.playing); }

  _schedule() {
    const t = this.track, spb = 60 / t.bpm / 2; // восьмые ноты
    while (this.nextTime < this.ctx.currentTime + 0.28) {
      this._playStep(t, this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64; // 4 аккорда x 16 восьмых
    }
  }

  _tone(freq, time, dur, gain, wave) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(this.master);
    o.start(time); o.stop(time + dur + 0.05);
  }

  _playStep(t, step, time, spb) {
    const chord = t.chords[Math.floor(step / 16) % t.chords.length];
    const inBar = step % 16;
    if (inBar === 0) { // пэд аккорда + бас
      chord.slice(1).forEach(m => this._tone(NOTE(m + 12), time, spb * 14, 0.05, t.wave));
      this._tone(NOTE(chord[0]), time, spb * 8, 0.16, 'sine');
    }
    if (inBar === 8) this._tone(NOTE(chord[0]), time, spb * 6, 0.12, 'sine');
    const mel = t.melody[inBar];
    if (mel !== null && mel !== undefined) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // пентатоника вверх
      const root = chord[1] + 12;
      const deg = scale[mel % scale.length] !== undefined ? scale[Math.min(mel, scale.length - 1)] : 0;
      this._tone(NOTE(root + deg), time, spb * 1.8, t.wave === 'square' ? 0.045 : 0.10, t.wave);
    }
  }

  /* ---------- SFX ---------- */
  sfx(name) {
    this._ensureCtx();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const seq = {
      pop:     [[660, 0, .09, .15], [880, .05, .1, .12]],
      coin:    [[988, 0, .08, .12], [1319, .07, .16, .12]],
      buy:     [[523, 0, .09, .13], [659, .08, .09, .13], [784, .16, .14, .13]],
      levelup: [[523, 0, .1, .14], [659, .09, .1, .14], [784, .18, .1, .14], [1047, .27, .22, .15]],
      error:   [[220, 0, .16, .1]],
      daily:   [[784, 0, .1, .13], [988, .09, .1, .13], [1175, .18, .2, .14]],
    }[name] || [];
    seq.forEach(([f, d, dur, g]) => this._toneDirect(f, now + d, dur, g));
  }

  _toneDirect(freq, time, dur, gain) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(time); o.stop(time + dur + 0.05);
  }
}

window.AtlandsMusic = new MusicEngine();
window.MUSIC_TRACKS = MUSIC_TRACKS;
