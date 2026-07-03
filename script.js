let state = 0;
let substate = 0;
let flickerTimer = null;
let whisperNodes = null;
const door = document.getElementById("door");
const instruction = document.getElementById("instruction");

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function drawCorridor(baseBrightness, progress, redIntensity, flickerMap, bloodSpots, distortion) {
  const canvas = document.getElementById("canvas-corridor");
  const ctx = canvas.getContext("2d");
  const w = 800,
    h = 600;
  const vx = w / 2,
    vy = 265;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, w, h);

  const steps = 60;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const depth = t * t;
    const phase = t * Math.PI * 3 + progress * Math.PI * 2;
    const swayMag = 0.25 + (distortion || 0) * 0.15;
    const sway = Math.sin(phase) * swayMag * t;
    points.push({ t, depth, sway });
  }

  const visScale = 1 + progress * 0.3 + (distortion || 0) * 0.2;
  function project(dist, lateral, height) {
    const scale = 1 / (1 + dist * 3 * visScale);
    const x = vx + lateral * w * scale;
    const y = vy + height * h * scale;
    return { x, y };
  }

  const noise = (n, seed) => ((seed * 7 + n * 13) % 17) / 17;

  for (let i = steps; i > 0; i--) {
    const p1 = points[i - 1];
    const p2 = points[i];

    const d1 = p1.depth;
    const d2 = p2.depth;
    const z1 = p1.sway;
    const z2 = p2.sway;

    const wide = 0.35;
    const tall = 0.45;

    const f1L = project(d1, -(wide + z1), -tall);
    const f1R = project(d1, wide - z1, -tall);
    const f2L = project(d1, -(wide + z1), tall);
    const f2R = project(d1, wide - z1, tall);

    const g1L = project(d2, -(wide + z2), -tall);
    const g1R = project(d2, wide - z2, -tall);
    const g2L = project(d2, -(wide + z2), tall);
    const g2R = project(d2, wide - z2, tall);

    const depthFactor = 1 - d2 * 0.7;

    const stain = (noise(i, 3) - 0.5) * 0.3;
    const stainFloor = (noise(i, 7) - 0.5) * 0.2;

    const brightness = Math.round(baseBrightness * depthFactor * (1 + stain));
    const floorBrightness = Math.round(
      baseBrightness * 0.7 * depthFactor * (1 + stainFloor),
    );
    const ceilBrightness = Math.round(baseBrightness * 0.4 * depthFactor);

    const foldShadow = Math.abs(z1 - z2) * 30;
    const shadowDepth = Math.min(foldShadow, 12);

    ctx.fillStyle = `rgb(${Math.max(brightness - shadowDepth, 0)}, ${Math.max(brightness - shadowDepth, 0)}, ${Math.max(brightness - shadowDepth, 0)})`;
    ctx.beginPath();
    ctx.moveTo(f1L.x, f1L.y);
    ctx.lineTo(g1L.x, g1L.y);
    ctx.lineTo(g2L.x, g2L.y);
    ctx.lineTo(f2L.x, f2L.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgb(${Math.max(brightness - 4 - shadowDepth, 0)}, ${Math.max(brightness - 4 - shadowDepth, 0)}, ${Math.max(brightness - 4 - shadowDepth, 0)})`;
    ctx.beginPath();
    ctx.moveTo(f1R.x, f1R.y);
    ctx.lineTo(g1R.x, g1R.y);
    ctx.lineTo(g2R.x, g2R.y);
    ctx.lineTo(f2R.x, f2R.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgb(${ceilBrightness}, ${ceilBrightness}, ${ceilBrightness})`;
    ctx.beginPath();
    ctx.moveTo(f1L.x, f1L.y);
    ctx.lineTo(g1L.x, g1L.y);
    ctx.lineTo(g1R.x, g1R.y);
    ctx.lineTo(f1R.x, f1R.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgb(${floorBrightness}, ${floorBrightness}, ${floorBrightness})`;
    ctx.beginPath();
    ctx.moveTo(f2L.x, f2L.y);
    ctx.lineTo(g2L.x, g2L.y);
    ctx.lineTo(g2R.x, g2R.y);
    ctx.lineTo(f2R.x, f2R.y);
    ctx.closePath();
    ctx.fill();

    if (i % 4 === 0) {
      const lightIdx = i / 4;
      if (!flickerMap || flickerMap[lightIdx]) {
        const lightSize = 0.04;
        const glowSize = 0.1;
        const lightY = -tall + 0.02;

        const cx = (f1L.x + f1R.x) / 2;
        const cy = (f1L.y + f1R.y) / 2;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 * (1 - d2));
        grad.addColorStop(0, "rgba(255, 220, 180, 0.15)");
        grad.addColorStop(1, "rgba(255, 220, 180, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 60, cy - 60, 120, 120);

        const ll = project(d1, -glowSize, lightY);
        const lr = project(d1, glowSize, lightY);
        const ll2 = project(d1, -lightSize, lightY + 0.02);
        const lr2 = project(d1, lightSize, lightY + 0.02);

        ctx.fillStyle = "rgba(255, 220, 180, 0.4)";
        ctx.beginPath();
        ctx.moveTo(ll.x, ll.y);
        ctx.lineTo(lr.x, lr.y);
        ctx.lineTo(lr2.x, lr2.y);
        ctx.lineTo(ll2.x, ll2.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (bloodSpots && bloodSpots[i]) {
      for (const spot of bloodSpots[i]) {
        const bx = f2L.x + spot.t * (f2R.x - f2L.x);
        const by = f2L.y + spot.t * (f2R.y - f2L.y);
        ctx.fillStyle = `rgba(120, 0, 0, ${spot.a})`;
        ctx.beginPath();
        ctx.ellipse(bx, by, spot.w, spot.h, spot.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const lineIntensity = 0.3 + (1 - d2) * 0.7;
    ctx.strokeStyle = `rgba(${redIntensity}, ${redIntensity * 0.15}, ${redIntensity * 0.15}, ${lineIntensity})`;
    ctx.lineWidth = 0.8;

    ctx.beginPath();
    ctx.moveTo(f1L.x, f1L.y);
    ctx.lineTo(f2L.x, f2L.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f1R.x, f1R.y);
    ctx.lineTo(f2R.x, f2R.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(f1L.x, f1L.y);
    ctx.lineTo(g1L.x, g1L.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f1R.x, f1R.y);
    ctx.lineTo(g1R.x, g1R.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(f2L.x, f2L.y);
    ctx.lineTo(g2L.x, g2L.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f2R.x, f2R.y);
    ctx.lineTo(g2R.x, g2R.y);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(${redIntensity}, ${redIntensity * 0.15}, ${redIntensity * 0.15}, 0.3)`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, vy);
  ctx.lineTo(w, vy);
  ctx.stroke();
}

function startNoSignal() {
  fetch("assets/sounds/nosignal.wav")
    .then((r) => r.arrayBuffer())
    .then((buf) => audioCtx.decodeAudioData(buf))
    .then((data) => {
      const src = audioCtx.createBufferSource();
      src.buffer = data;
      src.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.18;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
      noSignal = { src, gain };
    });
}
function stopNoSignal() {
  if (noSignal) {
    noSignal.src.stop();
    noSignal = null;
  }
}

function playStep() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 80;
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

function playHeartbeat() {
  function pulse(freq, delay) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + delay + 0.15,
    );
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 0.15);
  }
  pulse(50, 0);
  pulse(60, 0.12);
}

function playScream() {
  fetch("assets/sounds/horror-scream.wav")
    .then((r) => r.arrayBuffer())
    .then((buf) => audioCtx.decodeAudioData(buf))
    .then((data) => {
      const src = audioCtx.createBufferSource();
      src.buffer = data;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.5;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    });
}

let hum = null;

function startHum() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 60;
  gain.gain.value = 0.008;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  hum = { osc, gain };
}

function stopHum() {
  if (hum) {
    hum.osc.stop();
    hum = null;
  }
}

function startAlarm() {
  fetch("assets/sounds/scary-crushed-alarm.wav")
    .then((r) => r.arrayBuffer())
    .then((buf) => audioCtx.decodeAudioData(buf))
    .then((data) => {
        const src = audioCtx.createBufferSource();
        src.buffer = data;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.3;
        src.loop = true;
        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start();
        alarm = { src, gain }
    });
}

function stopAlarm() {
    if (alarm) {
        alarm.src.stop();
        alarm = null;
    }
}


function startWhisper() {
  const bufferSize = audioCtx.sampleRate * 3;
  const buf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize * 0.2);
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 0.8;

  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain);
  lfoGain.connect(bp.frequency);

  const gain = audioCtx.createGain();
  gain.gain.value = 0.08;

  src.connect(bp);
  bp.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
  lfo.start();

  whisperNodes = { src, lfo, bp, gain };
}

function stopWhisper() {
  if (whisperNodes) {
    whisperNodes.src.stop();
    whisperNodes.lfo.stop();
    whisperNodes = null;
  }
}


function generateBlood(level) {
  const spots = [];
  for (let i = 0; i < 60; i++) {
    spots[i] = [];
    if (i <= 5 || i >= 55) continue;
    for (let s = 0; s < level * 3; s++) {
      if (Math.random() > 0.55) continue;
      spots[i].push({
        t: Math.random(),
        w: 2 + Math.random() * 8,
        h: 1 + Math.random() * 4,
        r: Math.random() * Math.PI,
        a: 0.2 + Math.random() * 0.4
      });
    }
  }
  return spots;
}

function startFlicker(brightness, progress, red, blood, distortion) {
  stopFlicker();
  const bloodSpots = generateBlood(blood);
  const numLights = 15;
  const map = new Array(numLights).fill(true);

  function redraw() {
    for (let i = 0; i < numLights; i++) {
      if (Math.random() < 0.25) map[i] = !map[i];
    }
    drawCorridor(brightness, progress, red, map, bloodSpots, distortion);
  }

  redraw();
  flickerTimer = setInterval(redraw, 150 + Math.random() * 200);
}

function stopFlicker() {
  if (flickerTimer) {
    clearInterval(flickerTimer);
    flickerTimer = null;
  }
}

const staticCanvas = document.getElementById("static-canvas");
const staticCtx = staticCanvas.getContext("2d");

let staticTimer = null;

function drawStatic() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  staticCanvas.width = w / 4;
  staticCanvas.height = h / 4;
  const imageData = staticCtx.createImageData(staticCanvas.width, staticCanvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 255;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  staticCtx.putImageData(imageData, 0, 0);
}

function startStatic() {
  staticCanvas.style.display = "block";
  drawStatic();
  staticCanvas.style.opacity = "0";
  const flicker = () => {
    if (!staticCanvas.style.display || staticCanvas.style.display === "none") return;
    staticCanvas.style.opacity = (Math.random() * 0.4 + 0.1).toString();
    drawStatic();
    staticTimer = setTimeout(() => {
      staticCanvas.style.transition = "opacity 0.08s";
      staticCanvas.style.opacity = "0";
      staticTimer = setTimeout(() => {
        if (Math.random() < 0.4) {
          staticCanvas.style.transition = "";
          flicker();
        } else {
          const nextBurst = 2000 + Math.random() * 6000;
          staticTimer = setTimeout(flicker, nextBurst);
        }
      }, 80 + Math.random() * 200);
    }, 40 + Math.random() * 120);
  };
  flicker();
}

function stopStatic() {
  if (staticTimer) clearTimeout(staticTimer);
  staticCanvas.style.display = "none";
  staticCanvas.style.opacity = "0";
}


let rollTimer = null;

function triggerRoll() {
  const scene = document.getElementById("scene");
  scene.style.transition = "transform 0.05s";
  const offset = (Math.random() - 0.5) * 6;
  scene.style.transform = `translateY(${offset}px) skewX(${(Math.random() - 0.5) * 0.5}deg)`;
  rollTimer = setTimeout(() => {
    scene.style.transform = "";
    rollTimer = setTimeout(triggerRoll, 2000 + Math.random() * 5000);
  }, 60 + Math.random() * 80);
}

function stopRoll() {
  if (rollTimer) clearTimeout(rollTimer);
  document.getElementById("scene").style.transform = "";
}


let typewriterRunning = false;

function typewriterAndJumpScare() {
  if (typewriterRunning) return;

  typewriterRunning = true;
  const line1 = "तुम्हें इतनी दूर नहीं आना चाहिए था...";
  const line2 =
    " अब बहुत देर हो चुकी है, और इस अभिशप्त स्थान से पीछे हटने का कोई रास्ता नहीं बचा है।";

  const fullText = line1 + "\n" + line2;

  const el = document.getElementById("typewriter");
  el.style.display = "block";
  el.textContent = "";

  const script = [];
  const push = (n) => script.push(n);

  for (let i = 1; i <= 12; i++) push(i);
  for (let i = 11; i >= 4; i--) push(i);
  for (let i = 5; i <= 22; i++) push(i);
  for (let i = 21; i >= 10; i--) push(i);
  for (let i = 11; i <= 38; i++) push(i);
  for (let i = 37; i >= 18; i--) push(i);
  for (let i = 19; i <= fullText.length; i++) push(i);

  let idx = 0;

  function tick() {
    if (idx >= script.length) {

      const scene = document.getElementById("scene");
      scene.style.transition = "opacity 0.6s";
      scene.style.opacity = "0";

      setTimeout(() => {
        document.getElementById("canvas-corridor").style.display = "none";
        document.getElementById("jumpscare-img").style.display = "block";
        scene.style.opacity = "1";

        stopStatic();
        stopRoll();
        playScream();
        startAlarm();
        stopHum();
        stopNoSignal();
        stopAlarm();
      }, 700);
      return;
    }

    const len = script[idx];
    const raw = fullText.substring(0, len);
    el.textContent = raw.replace("\n", "");
    idx++;

    const isDeleting = idx < script.length && script[idx] < script[idx - 1];
    const delay = isDeleting ? 40 : 80;

    setTimeout(tick, delay);
  }

  tick();
}

function advanceState() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (!document.pointerLockElement) document.documentElement.requestPointerLock();
  state++;

  switch (state) {
    case 1:
      door.style.transform = "perspective(500px) rotateY(-100deg)";
      door.style.transformOrigin = "left center";
      door.style.transition = "transform 0.8s ease";

      setTimeout(() => {
        startHum();
        startNoSignal();
        startStatic();
        triggerRoll();
        door.style.display = "none";
        document.getElementById("corridor").style.display = "block";
        drawCorridor(55, 0, 255);
        instruction.textContent = "Click to advance";
        playStep();
      }, 900);
      break;

    case 2:
    case 3:
    case 4:
    case 5:
      substate++;
      if (substate < 3) {
        state--;
        const flash = document.createElement("div");
        flash.style.cssText =
          "position:absolute;inset:0;background:rgba(255,255,255,0.3);z-index:99;pointer-events:none";
        document.getElementById("scene").appendChild(flash);
        setTimeout(() => flash.remove(), 80);
        for (let e = 0; e < 6; e++) {
          const err = document.createElement("div");
          err.textContent = "ERROR";
          const side = Math.floor(Math.random() * 4);
          const x = side === 0 ? Math.random() * 30 : side === 1 ? 100 + Math.random() * 60 : Math.random() * 40;
          const y = side === 2 ? Math.random() * 20 : side === 3 ? 80 + Math.random() * 40 : Math.random() * 100;
          err.style.cssText = `position:absolute;left:${x}%;top:${y}%;color:#f00;font-size:${12 + Math.random() * 20}px;font-weight:bold;z-index:100;pointer-events:none;text-shadow:0 0 10px #f00;transform:rotate(${(Math.random() - 0.5) * 20}deg);opacity:${0.4 + Math.random() * 0.6}`;
          document.getElementById("scene").appendChild(err);
          setTimeout(() => err.remove(), 120 + Math.random() * 100);
        }
        return;
      }
      substate = 0;

      if (state === 2) drawCorridor(60, 0.15, 255);
      else if (state === 3) { drawCorridor(65, 0.3, 230); startWhisper(); }
      else if (state === 4) {
        startFlicker(45, 0.45, 200, 1, 1);
        playHeartbeat();
      } else if (state === 5) {
        startFlicker(35, 0.6, 180, 2, 2);
        playHeartbeat();
      }
      playStep();
      break;

    default:
      stopFlicker();
      stopWhisper();
      typewriterAndJumpScare();
      instruction.textContent = "";
      break;
  }
}

door.addEventListener("click", function (e) {
  e.stopPropagation();
  advanceState();
});

document.addEventListener("click", function () {
  if (state >= 1) advanceState();
});

const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar-fill');
let loadingProgress = 0;

function simulateLoading() {
    let stuck = 0;
    let target = 0;

    const interval = setInterval(() => {
        if (stuck > 0) {
            stuck --;
            return;
        }

        const roll = Math.random();
        if(roll < 0.1 && target > 30) {
            target -= 2 + Math.random() * 5;
        } else if (roll < 0.2 && target < 95) {
            stuck = 3 + Math.floor(Math.random() * 8);
            target += 0.5;
        } else {
            target += 1 + Math.random() * 6;
        }

        if (target > 100) target = 100;
        loadingBar.style.width = target + "%";

        if (target >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                loadingScreen.style.transition = 'opacity 0.5s';
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.style.display = 'none', 500);
            }, 400)
        }
    }, 100)
}

simulateLoading();
