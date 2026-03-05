const ffmpegStatic = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegStatic;

const express = require('express');
const { createCanvas } = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const W = 405, H = 720, FPS = 30, DURATION = 4;
const TOTAL_FRAMES = FPS * DURATION;

const ITEMS = [
  {label:'大吉',color:'#FFD700'},{label:'縁結び',color:'#FF6B9D'},
  {label:'金運UP',color:'#00D4AA'},{label:'吉',color:'#818CF8'},
  {label:'恋愛成就',color:'#FF4785'},{label:'中吉',color:'#F59E0B'},
  {label:'仕事運',color:'#38BDF8'},{label:'末吉',color:'#A78BFA'},
];
const LUCKY = [1,2,3,5,7,8,11,13,15,17,21,22,23,25,27,33,44,55,66,77,88,99];
const TAROT = [
  {name:'愚者',en:'THE FOOL',meaning:'新しい始まり・無限の可能性',color:'#FFD700'},
  {name:'魔術師',en:'THE MAGICIAN',meaning:'意志の力・創造の始まり',color:'#FF6B6B'},
  {name:'女教皇',en:'HIGH PRIESTESS',meaning:'直感・神秘的な知恵',color:'#C084FC'},
  {name:'女帝',en:'THE EMPRESS',meaning:'豊かさ・愛・母なる力',color:'#F472B6'},
  {name:'恋人',en:'THE LOVERS',meaning:'愛の選択・深い絆',color:'#FB7185'},
  {name:'運命の輪',en:'WHEEL OF FORTUNE',meaning:'転換期・運命の流れ',color:'#818CF8'},
  {name:'星',en:'THE STAR',meaning:'希望・再生・明るい未来',color:'#38BDF8'},
  {name:'月',en:'THE MOON',meaning:'潜在意識・隠された真実',color:'#A78BFA'},
];

function drawBg(ctx) {
  ctx.fillStyle = '#0D0A1E';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    const x = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
    const y = (Math.cos(i * 97.3) * 0.5 + 0.5) * H;
    ctx.beginPath();
    ctx.arc(x, y, Math.abs(Math.sin(i)) * 0.8 + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.abs(Math.sin(i)) * 0.1})`;
    ctx.fill();
  }
}

function txt(ctx, t, x, y, sz, col, align = 'center') {
  ctx.save();
  ctx.font = `900 ${sz}px sans-serif`;
  ctx.fillStyle = col;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x, y);
  ctx.restore();
}

function gtxt(ctx, t, x, y, sz, col) {
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 20;
  txt(ctx, t, x, y, sz, col);
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHeader(ctx, sub) {
  txt(ctx, '✦  URANAI  ✦', W/2, 44, 10, 'rgba(245,200,66,0.5)');
  ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
  txt(ctx, '神秘の占い', W/2, 84, 26, '#fff');
  ctx.restore();
  txt(ctx, sub, W/2, 116, 12, 'rgba(255,255,255,0.4)');
}

function drawFooter(ctx) {
  txt(ctx, 'あなたの運命が今、動き出す', W/2, H - 56, 12, 'rgba(255,255,255,0.35)');
  txt(ctx, '✦', W/2, H - 28, 14, 'rgba(155,92,246,0.5)');
}

function drawWheel(ctx, angle) {
  const cx = W/2, cy = H/2 - 10, R = 148, sa = (2 * Math.PI) / ITEMS.length;
  ctx.save(); ctx.shadowColor = '#9B5CF6'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(155,92,246,0.25)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  ITEMS.forEach((item, i) => {
    const s = angle + i * sa, e = s + sa;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, s, e); ctx.closePath();
    ctx.fillStyle = item.color; ctx.fill();
    ctx.strokeStyle = 'rgba(13,10,30,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + sa / 2);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#0D0A1E'; ctx.textBaseline = 'middle';
    ctx.fillText(item.label, R - 16, 0); ctx.restore();
  });
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
  cg.addColorStop(0, '#c084fc'); cg.addColorStop(1, '#7c3aed');
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = cg; ctx.fill();
  ctx.save(); ctx.translate(cx, cy - R - 14);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, -17); ctx.lineTo(9, -17); ctx.closePath();
  ctx.fillStyle = '#c084fc'; ctx.fill(); ctx.restore();
}

function frameRoulette(ctx, p, state) {
  drawBg(ctx); drawHeader(ctx, '運勢ルーレット');
  const eased = 1 - Math.pow(1 - p, 4);
  drawWheel(ctx, state.wheelTarget * eased);
  if (p > 0.88 && state.result) {
    const a = Math.min((p - 0.88) / 0.12, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(155,92,246,0.2)';
    rr(ctx, W/2 - 120, H - 200, 240, 70, 16); ctx.fill();
    ctx.strokeStyle = state.result.color; ctx.lineWidth = 2;
    rr(ctx, W/2 - 120, H - 200, 240, 70, 16); ctx.stroke();
    gtxt(ctx, state.result.label, W/2, H - 165, 30, state.result.color);
    txt(ctx, '今日のあなたの運勢', W/2, H - 138, 12, 'rgba(255,255,255,0.5)');
    ctx.restore();
  }
  drawFooter(ctx);
}

function frameNumber(ctx, p, state) {
  drawBg(ctx); drawHeader(ctx, 'ラッキーナンバー');
  const cx = W/2, cy = H/2 - 10, bw = 96, bh = 96, gap = 14;
  const totalW = bw * 3 + gap * 2, sx = cx - totalW / 2;
  for (let i = 0; i < 3; i++) {
    const bx = sx + i * (bw + gap), by = cy - bh / 2;
    const locked = p > (0.45 + i * 0.18);
    ctx.save();
    ctx.fillStyle = locked ? 'rgba(245,200,66,0.1)' : 'rgba(155,92,246,0.12)';
    rr(ctx, bx, by, bw, bh, 14); ctx.fill();
    ctx.strokeStyle = locked ? 'rgba(245,200,66,0.6)' : 'rgba(155,92,246,0.35)';
    ctx.lineWidth = 2; rr(ctx, bx, by, bw, bh, 14); ctx.stroke(); ctx.restore();
    const num = locked ? String(state.picks[i]).padStart(2, '0') :
      String(LUCKY[Math.floor((p * 100 + i * 17) % LUCKY.length)]).padStart(2, '0');
    ctx.save(); ctx.font = '900 36px monospace';
    ctx.fillStyle = locked ? '#F5C842' : '#c084fc';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, bx + bw / 2, cy); ctx.restore();
  }
  if (p > 0.84) {
    const a = Math.min((p - 0.84) / 0.16, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(245,200,66,0.1)';
    rr(ctx, W/2 - 150, H/2 + 72, 300, 52, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(245,200,66,0.4)'; ctx.lineWidth = 1;
    rr(ctx, W/2 - 150, H/2 + 72, 300, 52, 14); ctx.stroke();
    txt(ctx, state.msg, W/2, H/2 + 98, 13, 'rgba(245,200,66,0.9)');
    ctx.restore();
  }
  drawFooter(ctx);
}

function drawCardBack(ctx, cx, cy, cw, ch) {
  ctx.fillStyle = '#1e1b4b'; rr(ctx, cx - cw/2, cy - ch/2, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(155,92,246,0.5)'; ctx.lineWidth = 2;
  rr(ctx, cx - cw/2, cy - ch/2, cw, ch, 16); ctx.stroke();
  ctx.fillStyle = 'rgba(155,92,246,0.15)';
  rr(ctx, cx - cw/2 + 12, cy - ch/2 + 12, cw - 24, ch - 24, 10); ctx.fill();
  txt(ctx, '✦', cx, cy, 28, 'rgba(192,132,252,0.35)');
}

function drawCardFront(ctx, cx, cy, cw, ch, card) {
  const g = ctx.createLinearGradient(cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2);
  g.addColorStop(0, '#1a0f3c'); g.addColorStop(1, '#0D0A1E');
  ctx.fillStyle = g; rr(ctx, cx - cw/2, cy - ch/2, cw, ch, 16); ctx.fill();
  ctx.strokeStyle = card.color + '70'; ctx.lineWidth = 2;
  rr(ctx, cx - cw/2, cy - ch/2, cw, ch, 16); ctx.stroke();
  txt(ctx, card.en, cx, cy - ch/2 + 22, 10, 'rgba(255,255,255,0.3)');
  ctx.save(); ctx.font = 'bold 21px sans-serif'; ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; ctx.fillStyle = card.color;
  ctx.shadowColor = card.color; ctx.shadowBlur = 14;
  ctx.fillText(card.name, cx, cy + 20); ctx.restore();
  txt(ctx, card.meaning, cx, cy + 60, 11, 'rgba(255,255,255,0.5)');
}

function frameTarot(ctx, p, state) {
  drawBg(ctx); drawHeader(ctx, 'タロットリーディング');
  const cx = W/2, cy = H/2 - 20, cw = 170, ch = 268;
  if (p < 0.38) {
    const wobble = Math.sin(p * Math.PI * 8) * 0.06;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(wobble);
    drawCardBack(ctx, 0, 0, cw, ch); ctx.restore();
  } else if (p < 0.62) {
    const fp = (p - 0.38) / 0.24;
    const sx = Math.cos(fp * Math.PI);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1);
    if (fp < 0.5) drawCardBack(ctx, 0, 0, cw, ch);
    else drawCardFront(ctx, 0, 0, cw, ch, state.card);
    ctx.restore();
  } else {
    ctx.save(); ctx.shadowColor = state.card.color; ctx.shadowBlur = 30;
    drawCardFront(ctx, cx, cy, cw, ch, state.card); ctx.restore();
    if (p > 0.8) {
      const a = Math.min((p - 0.8) / 0.2, 1);
      ctx.save(); ctx.globalAlpha = a;
      txt(ctx, state.card.meaning, cx, cy + ch/2 + 38, 12, 'rgba(255,255,255,0.55)');
      ctx.restore();
    }
  }
  drawFooter(ctx);
}

async function generateVideo(type) {
  const tmpDir = path.join(os.tmpdir(), uuidv4());
  fs.mkdirSync(tmpDir, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  let state = {};
  if (type === 'roulette') {
    state.wheelTarget = (5 + Math.random() * 5) * 2 * Math.PI;
    state.result = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  } else if (type === 'number') {
    state.picks = [0,1,2].map(() => LUCKY[Math.floor(Math.random() * LUCKY.length)]);
    const msgs = ['この数字があなたの縁を結ぶ','あの人との距離を縮める鍵','宇宙があなたに贈る数字'];
    state.msg = msgs[state.picks[0] % msgs.length];
  } else {
    state.card = TAROT[Math.floor(Math.random() * TAROT.length)];
  }
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const p = i / (TOTAL_FRAMES - 1);
    if (type === 'roulette') frameRoulette(ctx, p, state);
    else if (type === 'number') frameNumber(ctx, p, state);
    else frameTarot(ctx, p, state);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(tmpDir, `frame${String(i).padStart(4,'0')}.png`), buf);
  }
  const outPath = path.join(tmpDir, 'output.mp4');
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(tmpDir, 'frame%04d.png'))
      .inputFPS(FPS)
      .videoCodec('libx264')
      .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23'])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return { outPath, tmpDir };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/generate', async (req, res) => {
  const { type } = req.body;
  if (!['roulette', 'number', 'tarot'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  try {
    const { outPath, tmpDir } = await generateVideo(type);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="uranai-${type}.mp4"`);
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
