// 复现用户场景：验证为什么 fierce 会在"未学习 585"时重复出现
const fs = require('fs');
const lines = fs.readFileSync('/workspace/index.html', 'utf8').split('\n');

let startIdx = -1, endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (startIdx === -1 && lines[i].startsWith('const RAW_WORDS = ')) startIdx = i;
  else if (startIdx !== -1 && lines[i].replace(/\r$/, '') === '`') { endIdx = i; break; }
}
const RAW_WORDS = lines.slice(startIdx + 1, endIdx).join('\n');

function parseWords(raw) {
  return raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    .map(l => {
      const m = l.match(/^(\S+)\s+(\/[^/]*\/)?\s*(.+)$/);
      return m ? { word: m[1], phonetic: m[2] || '', explain: m[3].trim() } : null;
    }).filter(w => w && w.word && w.explain);
}
const WORDS = parseWords(RAW_WORDS);
console.log('词库总数:', WORDS.length);
console.log('fierce 在词库中:', WORDS.find(w => w.word === 'fierce'));

// ====== 模拟用户场景 ======
let mode = 'all';
let wordStatus = {};
let seenInRound = new Set();

function getStatus(word) { return wordStatus[word] || 0; }

function getPool() {
  let base;
  if (mode === 'unknown') base = WORDS.filter(w => getStatus(w.word) !== 1);
  else base = WORDS;
  let pool = base.filter(w => !seenInRound.has(w.word));
  if (pool.length === 0 && base.length > 0) {
    seenInRound.clear();
    pool = base.slice();
  }
  return pool;
}

function nextQuestion() {
  const pool = getPool();
  if (pool.length === 0) return null;
  const w = pool[Math.floor(Math.random() * pool.length)];
  seenInRound.add(w.word);
  return w;
}

function onAnswer(word, correct) { wordStatus[word] = correct ? 1 : 2; }

// 场景 1：模拟用户刷 651 题，其中 493 对 158 错，但过程中有刷新/切换模式
console.log('\n===== 场景 1：模拟 651 次答题，每 100 次模拟一次"刷新" =====');
seenInRound.clear(); wordStatus = {}; mode = 'all';

let fierceCount = 0;
let refreshCount = 0;
for (let i = 0; i < 651; i++) {
  // 每 100 题模拟一次页面刷新（seenInRound 清空，wordStatus 保留）
  if (i > 0 && i % 100 === 0) {
    seenInRound.clear();
    refreshCount++;
  }
  const q = nextQuestion();
  if (!q) break;
  if (q.word === 'fierce') fierceCount++;
  // 模拟 76% 正确率（493/651）
  onAnswer(q.word, Math.random() < 0.76);
}
console.log(`刷新次数: ${refreshCount}`);
console.log(`fierce 出现次数: ${fierceCount}`);
console.log(`认识: ${Object.values(wordStatus).filter(s => s === 1).length}`);
console.log(`不认识: ${Object.values(wordStatus).filter(s => s === 2).length}`);
console.log(`未学习: ${WORDS.length - Object.keys(wordStatus).length}`);

// 场景 2：模拟用户切换模式
console.log('\n===== 场景 2：模拟切换模式导致 seenInRound 清空 =====');
seenInRound.clear(); wordStatus = {}; mode = 'all';
let fierceCount2 = 0;
let switchCount = 0;
for (let i = 0; i < 651; i++) {
  // 每 50 题切换一次模式
  if (i > 0 && i % 50 === 0) {
    mode = mode === 'all' ? 'unknown' : 'all';
    seenInRound.clear();
    switchCount++;
  }
  const q = nextQuestion();
  if (!q) break;
  if (q.word === 'fierce') fierceCount2++;
  onAnswer(q.word, Math.random() < 0.76);
}
console.log(`切换模式次数: ${switchCount}`);
console.log(`fierce 出现次数: ${fierceCount2}`);

// 场景 3：模拟"只刷不认识"模式下的重复
console.log('\n===== 场景 3：unknown 模式下 pool 缩小导致重复 =====');
seenInRound.clear(); wordStatus = {}; mode = 'all';
// 先刷 300 题 all 模式
for (let i = 0; i < 300; i++) {
  const q = nextQuestion(); if (!q) break;
  onAnswer(q.word, Math.random() < 0.76);
}
// 切到 unknown 模式
mode = 'unknown';
seenInRound.clear();
let fierceCount3 = 0;
for (let i = 0; i < 400; i++) {
  const q = nextQuestion(); if (!q) break;
  if (q.word === 'fierce') fierceCount3++;
  onAnswer(q.word, Math.random() < 0.3); // 故意答错率高
}
console.log(`unknown 模式 fierce 出现次数: ${fierceCount3}`);

console.log('\n===== 结论 =====');
console.log('截图数据：1236 总单词，493 认识，158 不认识，585 未学习，词库单词数 1069');
console.log('已答题 = 651，本轮已出 = 167，差值 = 484');
console.log('这说明 seenInRound 被清空了约 4~5 次（刷新/切换模式）');
console.log('fierce 可能在不同轮次中被多次抽到，但因为 wordStatus 是 localStorage 持久化，');
console.log('所以"未学习"数量不会重复扣减——这是正确的行为，但用户感知是"重复出现"');
