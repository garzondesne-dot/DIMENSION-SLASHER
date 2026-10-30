// 절차적 Web Audio 신디사이저: 효과음을 파일 없이 오실레이터와 노이즈로 합성한다.
window.DS = window.DS || {};

DS.Sound = (function () {
  let ctx = null, master = null, noiseBuf = null, muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.3, delay = 0 }) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, freq = 2000, sweepTo, q = 1, type = 'bandpass', delay = 0 }) {
    const c = ensure();
    if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  return {
    unlock: ensure,
    toggle() { muted = !muted; return muted; },
    get muted() { return muted; },

    card() { noise({ dur: 0.06, vol: 0.15, freq: 5000 }); },
    // 검기 베기 + 서브베이스
    slash() {
      noise({ dur: 0.2, vol: 0.5, freq: 7000, sweepTo: 700, q: 0.7 });
      tone({ type: 'sine', f0: 95, f1: 38, dur: 0.3, vol: 0.55 });
    },
    hit() {
      noise({ dur: 0.12, vol: 0.4, freq: 900, type: 'lowpass' });
      tone({ type: 'square', f0: 170, f1: 60, dur: 0.12, vol: 0.18 });
    },
    // 수식 발동 마법 공명음
    magic() {
      tone({ type: 'sine', f0: 440, f1: 880, dur: 0.4, vol: 0.15 });
      tone({ type: 'sine', f0: 443, f1: 1320, dur: 0.45, vol: 0.1, delay: 0.03 });
    },
    block() {
      tone({ type: 'triangle', f0: 520, f1: 470, dur: 0.18, vol: 0.2 });
      noise({ dur: 0.08, vol: 0.18, freq: 3200 });
    },
    // 금속 철갑 파쇄음
    armorBreak() {
      for (let i = 0; i < 6; i++) {
        tone({ type: 'square', f0: 1300 + Math.random() * 1800, f1: 250, dur: 0.28, vol: 0.07, delay: i * 0.035 });
      }
      noise({ dur: 0.45, vol: 0.5, freq: 4500, sweepTo: 400 });
      tone({ type: 'sine', f0: 75, f1: 30, dur: 0.45, vol: 0.6 });
    },
    shieldBreak() {
      for (let i = 0; i < 4; i++) tone({ type: 'triangle', f0: 2200 - i * 300, f1: 600, dur: 0.3, vol: 0.09, delay: i * 0.05 });
      noise({ dur: 0.5, vol: 0.45, freq: 6000, sweepTo: 600, q: 2 });
    },
    correct() {
      [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.25, vol: 0.18, delay: i * 0.07 }));
    },
    wrong() { tone({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.35, vol: 0.13 }); },
    // 대장간 망치질 + 반짝임
    forge() {
      tone({ type: 'square', f0: 1800, f1: 900, dur: 0.12, vol: 0.12 });
      noise({ dur: 0.15, vol: 0.35, freq: 3000, q: 3 });
      [988, 1319, 1976].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.4, vol: 0.1, delay: 0.15 + i * 0.08 }));
    },
    clank() { tone({ type: 'square', f0: 900, f1: 500, dur: 0.08, vol: 0.08 }); },
    enemyAtk() {
      tone({ type: 'sawtooth', f0: 130, f1: 45, dur: 0.32, vol: 0.28 });
      noise({ dur: 0.25, vol: 0.35, freq: 500, type: 'lowpass' });
    },
    hurt() { tone({ type: 'square', f0: 300, f1: 90, dur: 0.2, vol: 0.15 }); },
    // 테이프 되감기
    rewind() {
      tone({ type: 'sawtooth', f0: 900, f1: 80, dur: 1.2, vol: 0.1 });
      for (let i = 0; i < 10; i++) noise({ dur: 0.08, vol: 0.15, freq: 1500 + i * 300, delay: i * 0.11 });
    },
    scan() {
      tone({ type: 'sine', f0: 1200, f1: 2400, dur: 0.18, vol: 0.12 });
      tone({ type: 'sine', f0: 1800, f1: 3600, dur: 0.18, vol: 0.08, delay: 0.1 });
    },
    whoosh() { noise({ dur: 0.35, vol: 0.3, freq: 500, sweepTo: 4000, q: 0.8 }); },
    heartbeat() {
      tone({ type: 'sine', f0: 70, f1: 40, dur: 0.14, vol: 0.6 });
      tone({ type: 'sine', f0: 65, f1: 38, dur: 0.16, vol: 0.45, delay: 0.18 });
    },
    crit() {
      tone({ type: 'square', f0: 1600, f1: 3200, dur: 0.12, vol: 0.12 });
      noise({ dur: 0.3, vol: 0.4, freq: 8000, sweepTo: 1500, q: 1.5 });
    },
    // 보물상자 자물쇠가 풀리는 소리: 철컥 + 짧은 종소리
    latch() {
      tone({ type: 'square', f0: 1300, f1: 600, dur: 0.06, vol: 0.12 });
      noise({ dur: 0.08, vol: 0.25, freq: 2500, delay: 0.05 });
      tone({ type: 'square', f0: 500, f1: 260, dur: 0.1, vol: 0.12, delay: 0.12 });
      tone({ type: 'sine', f0: 1046, dur: 0.25, vol: 0.12, delay: 0.32 });
      tone({ type: 'sine', f0: 1568, dur: 0.4, vol: 0.1, delay: 0.42 });
    },
    coin() {
      tone({ type: 'square', f0: 988, dur: 0.06, vol: 0.08 });
      tone({ type: 'square', f0: 1319, dur: 0.18, vol: 0.08, delay: 0.06 });
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.45, vol: 0.18, delay: i * 0.12 }));
    },
  };
})();
