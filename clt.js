// ============================================================
// clt.js
// 变化定位任务 (Change Localization Task, CLT)
// 基于 CLT.m (0630版) 实验规则
//
// 实验设计：
//   2×1 设计：set size (4, 6)，所有试次均为 change trial
//   SS4 和 SS6 各 40 trial，共 80 trial，均分到 4 个 block（每 block 20 trial）
//   练习 10 trial（2 种 set size × 5）
//
// 试次结构：
//   1. ITI              (500 ms)    显示注视点
//   2. 学习阵列         (250 ms)    显示注视点
//   3. 保留间隔         (1000 ms)   显示注视点（注视点全程固定显示，不消失）
//   4. 测试阵列         (无时间限制) 显示注视点
//
// Block 规则：
//   4 个 block，每 block 20 trial；block 间强制休息至少 15 秒（含倒计时），
//   倒计时结束后显示「您可以继续休息或按【SPACE】开始下一组实验」，按 SPACE 进入下一组
//   不设「低正确率自动结束」：无论正确率高低，实验都完整跑完 4 个 block
//   低正确率只做标记：set size = 4 的平均正确率低于 50% 时，
//   在导出文件名最前面加 F（如 F20260910_1234567890.xlsx）
//
// 调试模式（被试信息四个输入框全部填 1，隐藏触发）：
//   除每个 block 试次数 35 → 5（共 20 trial）外，其余流程与正式实验完全一致
//   （练习 10 trial、block 间强制休息 ≥30 秒、数据保存等均不变）
//   被试编号与随机种子固定为 1111，导出文件名固定为 1111.xlsx
//
// 导出（Excel，3 个 sheet，调试模式与正式实验规则完全一致）：
//   文件名：正式实验 = 实验日期_被试编号（YYYYMMDD_编号），
//                      SS4 平均正确率 < 50% 时前面加 F；
//           调试模式 = 1111.xlsx（固定，不加 F）
//   Sheet1 被试信息：姓名 / 性别 / 年龄 / 身份证号 / 手机号
//   Sheet2 实验数据：全部 trial 的 SetSize、正确按键、被试实际按键、反应时、是否正确
//   Sheet3 实验结果：SS4 / SS6 各自的 Acc、平均 RT（正确试次）、K
//                   以及「低正确率标记」（SS4 平均正确率 < 50% 时为 1）
//   K = (Acc * N^2 - N) / (N - 1)
//
// 颜色规则（每个试次由 buildProbePlan 一次算好并冻结，drawPlanSquares 只按计划绘制）：
//   记忆阵列：从 9 色调色板中不重复地随机取 setSize 个颜色
//   探测阵列：复制记忆阵列颜色，只替换「变化方块」一个 → 有且只有一个色块变色
//   新颜色  ：只能从「记忆阵列中没出现过的颜色」里挑（严格排除，无兜底放宽）
//   计划生成后立即自检 verifyProbePlan()，违反则 console.error 报警（probePlanViolations）
//   探测阵列直接使用记忆阵列那一份 plan，不会因重入/并发读到别的试次的数据
//
// 按键：数字键 1/2/3/8/9/0（对应 CLT.m prefs.numKeys）
//   每个试次从 {1,2,3,8,9,0} 中随机抽取 nItems 个字符作为标签显示
//   （对应 CLT.m trialLabels = randperm(6)(1:nItems)）
//   只接受本试次显示出来的数字键；正确反应 = 变色方块所在标签槽的编号
//
// 变化颜色规则：
//   被选方块变为一个未在阵列中出现过的 新颜色
//   （若所有颜色均已使用，选不同于原色的任意颜色）
//
// 标签映射：
//   labelMap = randperm(nItems)，标签 i 显示在 labelMap[i] 对应的方块上方
//   正确反应 = 变色方块的标签编号
// ============================================================

// 运行版本标记（与 clt.html 中 clt.js?v= 保持一致）：
// 用于确认浏览器实际加载的是最新代码，而非缓存里的旧版本
const CLT_BUILD = '20261120-123890-3';
console.log('[CLT] build ' + CLT_BUILD + ' loaded');

// 在设置页显示当前 build（确认浏览器加载的是最新代码，而非缓存中的旧版）
(function showBuildTag() {
    const tag = document.getElementById('build-tag');
    if (tag) tag.innerText = 'clt.js build ' + CLT_BUILD;
})();

// 版本自检：页面（clt.html）与脚本（clt.js）版本号必须一致。
// 不一致说明浏览器缓存了旧的 clt.js（实验会跑出旧规则、旧导出文件名），
// 在设置页直接给出告警，避免又用旧代码跑一整轮实验。
(function checkBuildMatch() {
    const pageBuild = window.CLT_PAGE_BUILD;
    if (pageBuild && pageBuild !== CLT_BUILD) {
        console.warn('[CLT] 版本不一致：页面 ' + pageBuild + ' / 脚本 ' + CLT_BUILD +
            ' —— 浏览器可能缓存了旧 clt.js，请 Ctrl+F5 强制刷新');
        const el = document.getElementById('build-mismatch');
        if (el) el.classList.remove('hidden');
    }
})();

let supabaseClient = null;
const SUPABASE_URL = "https://rnfwxphdzvonoiduidsg.supabase.co";
const SUPABASE_KEY = "sb_publishable_kdXRnhVgTwsfgrrzO0ok8A_PZOKfHZK";
const EXPERIMENT_VERSION = 'clt_traditional_123890';
const SESSION_ID = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : 'session-' + Date.now() + '-' + Math.random().toString(16).slice(2);
let p = {};
let stimData = [];
let practiceData = [];
let currentBlock = 1;
let currentTrial = 0;
let blockTrials = [];
let experimentPhase = 'setup';
let currentNItems = 4; // 当前试次的 set size，用于键盘响应范围判断
let lowAccBlockCount = 0;        // 正确率低于 50% 的 block 累计数（只统计，不终止实验）
// 低正确率标记：set size = 4 的平均正确率低于 50% 时为 true，导出文件名最前面加 F。
// 注意：实验本身不再因低正确率提前结束，永远跑完 4 个 block。
let ss4LowAccuracyFlag = false;

// --- 实验参数（对应 CLT.m getPreferences） ---
const prefs = {
    setSizes: [4, 6],
    numBlocks: 4,
    numTrials: 20,
    nEachSS: 40,            // 每个 set size 40 trial
    nPractice: 16,          // 练习 16 trial
    ITI: 500,               // ms
    studyDuration: 250,     // ms（对应 MATLAB studyDuration）
    retentionInterval: 1000,// ms
    stimSize: 51,
    minDist: 51 * 2.5,
    fixationSize: 8,
    breakLength: 0.25,              // 分钟 = 15 秒，与原始 exp1_clt 一致
    labelFontSize: 18
};

// --- CLT 反应键 / 标签字符（对应 CLT.m prefs.labelChars）---
// 数字 123890 完全随机出现：左手放在 123，右手放在 890
const LABEL_CHARS = ['1', '2', '3', '8', '9', '0'];
let trialLabels = [];   // 本试次各标签槽使用的字符索引（长度 = nItems）

const colors_9 = [
    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0],
    [255, 0, 255], [0, 255, 255], [255, 255, 255], [0, 0, 0], [255, 128, 0]
];

// --- PRNG ---
let seed = 1;
function seedRandom(s) { seed = s; }
function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function randInt(min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
}

// --- 高精度计时器 ---
function wait(ms) {
    return new Promise(resolve => {
        const start = performance.now();
        function check(time) {
            if (time - start >= ms) { resolve(); }
            else { requestAnimationFrame(check); }
        }
        requestAnimationFrame(check);
    });
}

// --- DOM 元素 ---
// 问卷阶段已删除，因此 screens 中不再包含 questionnaire 键
const screens = {
    setup: document.getElementById('setup-phase'),
    instructions: document.getElementById('instructions-phase'),
    experiment: document.getElementById('experiment-phase'),
    break: document.getElementById('break-phase'),
    upload: document.getElementById('upload-phase'),
    finished: document.getElementById('finished-phase')
};
const canvas = document.getElementById('expCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// --- 匿名被试编号：仅依据组别生成，不收集任何个人信息 ---
const subjectIDInput = document.getElementById('subjectID');
const subGroupInput = document.getElementById('subGroup');
function generateSubjectID(subGroupValue) {
    const group = normalizeDigits(subGroupValue);
    if (group === '0') return '1111';
    const order = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const suffix = Array.from({ length: 3 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    return `${group}_${order}_${suffix}`;
}
function updateSubjectID() {
    if (subjectIDInput && subGroupInput) subjectIDInput.value = /^[012]$/.test(normalizeDigits(subGroupInput.value)) ? generateSubjectID(subGroupInput.value) : '';
}
if (subGroupInput) subGroupInput.addEventListener('input', updateSubjectID);

// 掩蔽身份证号（用于数据导出，保护隐私）
function maskIdCard(idCard) {
    if (!idCard) return '';
    if (idCard.length > 10) {
        return idCard.substring(0, 4)
            + '*'.repeat(idCard.length - 10)
            + idCard.substring(idCard.length - 6);
    }
    return idCard;
}

// 组别（两个范式的先后顺序，被试间变量）：
//   1 = 先做变化觉察任务（FCDT）再做变化定位任务（CLT）
//   2 = 先做变化定位任务（CLT）再做变化觉察任务（FCDT）
// 123890 为独立 CLT 版本，默认 Order = 2（先做 CLT）
const GROUP_LABELS = {
    1: '1 = 先做变化觉察任务（FCDT），再做变化定位任务（CLT）',
    2: '2 = 先做变化定位任务（CLT），再做变化觉察任务（FCDT）'
};

function readSubGroup() {
    const input = document.getElementById('subGroup');
    return normalizeDigits(input ? input.value : '');
}

// 全角数字 → 半角数字（中文输入法打出的「１」会被折算成「1」）
// 组别校验与调试模式触发判定共用，避免「明明填了 1 却没进调试模式」
function normalizeDigits(v) {
    return String(v == null ? '' : v)
        .trim()
        .replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
}

function exportNum(v) {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
}

function conditionLabel(setSize) {
    // CLT 固定 250ms，条件标签只含 set size
    return 'SS' + setSize;
}

// --- 设置表单 ---
document.getElementById('start-btn').addEventListener('click', async () => {
    const form = document.getElementById('setup-form');
    if (!form.reportValidity()) return;

    p.subName = '';
    p.subGender = '';
    p.subAge = '';
    p.subIdCard = '';
    p.subPhone = '';

    // 组别：两个范式的先后顺序（被试间变量），只接受 1 或 2。
    // HTML 侧已用 pattern="[12]" + required 做第一层拦截，这里再显式校验一次：
    // 一是兜住全角数字与粘贴带空格的情况，二是把合法取值告诉被试（页面上不写）。
    const subGroupValue = readSubGroup();
    if (!/^[012]$/.test(subGroupValue)) {
        alert('组别填写有误，请按主试安排填写：\n' + GROUP_LABELS[1] + '\n' + GROUP_LABELS[2]);
        const subGroupInput = document.getElementById('subGroup');
        if (subGroupInput && subGroupInput.focus) subGroupInput.focus();
        return;
    }
    p.subGroup = Number(subGroupValue);

    // 匿名编号由组别生成；0 为固定调试编号。
    p.subjectID = generateSubjectID(subGroupValue);
    if (subjectIDInput) subjectIDInput.value = p.subjectID;
    const seedNum = Number.parseInt(p.subjectID.replace(/\D/g, '').slice(-9), 10);
    p.rndSeed = Number.isFinite(seedNum) ? seedNum : Date.now();
    p.saveLocal = true; // 保存到本地始终开启（复选框已隐藏，网页端数据库 + 本地均保存）
    p.expDate = formatDateYYYYMMDD(new Date()); // 实验日期（导出文件名用）

    // 调试模式触发（复选框已隐藏）：姓名字段填 1
    // （性别为下拉选择，不参与判定；subjectID 自动生成不受影响）
    // 判定做了容错：中文输入法打出的全角「１」自动折算为半角
    const normalizeOnes = (v) => String(v == null ? '' : v)
        .trim()
        .replace(/[\uFF10-\uFF19]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
    const isAllOnes = (v) => /^1+$/.test(normalizeOnes(v));
    p.debugMode = subGroupValue === '0';
    if (p.debugMode) {
        console.log('[CLT] 调试模式已触发（姓名为 1）');
    } else {
        console.log(`[CLT] 正式模式（姓名="${p.subName}" 年龄="${p.subAge}" ` +
            `身份证号长度=${String(p.subIdCard || '').length} 手机号="${p.subPhone}"）`);
    }

    // 调试模式：练习、正式实验流程、block 间休息等全部与正式实验完全一致，
    // 唯一差异是每个 block 的试次数由 35 降为 5（4 block × 5 = 20 trial，SS4/SS6 各 10）；
    // 被试编号与随机种子一并固定为 1111（导出文件名也是 1111.xlsx），便于识别与复现
    if (p.debugMode) {
        prefs.numTrials = 5;
        prefs.nEachSS = 10;
        p.subjectID = '1111';
        p.rndSeed = 1111;
        subjectIDInput.value = '1111'; // 设置页同步显示，与导出文件名一致
    }

    seedRandom(p.rndSeed);

    try {
        if (SUPABASE_URL !== "YOUR_SUPABASE_URL_HERE") {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false }
            });
        }
    } catch (err) { console.error("Supabase init failed", err); }

    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }
    } catch (err) { console.log("Fullscreen denied."); }

    switchScreen('instructions');
    experimentPhase = 'instructions';
});

function switchScreen(screenName) {
    for (let key in screens) screens[key].classList.add('hidden');
    screens[screenName].classList.remove('hidden');
}

// --- 全局键盘监听 ---
// CLT 使用数字键 1/2/3/8/9/0 作为反应键（与 SP/FP 的 Z// 不同）
// 仅接受本试次实际显示出来的数字键
window.addEventListener('keydown', (e) => {
    // 长按产生的重复按键一律忽略：否则一次试次会被记录多次，
    // 并触发多条并行的试次流程，导致界面上出现「多个色块同时变色」。
    if (e.repeat) return;

    if (experimentPhase === 'instructions' && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        startPractice();
    } else if (experimentPhase === 'practice_response') {
        let slot = keyToLabelSlot(e.key);
        if (slot > 0) {
            e.preventDefault();
            recordPracticeResponse(slot, e.key);
        }
    } else if (experimentPhase === 'practice_end' && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        startFormal();
    } else if (experimentPhase === 'trial_response') {
        let slot = keyToLabelSlot(e.key);
        if (slot > 0) {
            e.preventDefault();
            recordResponse(slot, e.key);
        }
    } else if (experimentPhase === 'break_countdown' || experimentPhase === 'break_wait') {
        // 休息阶段：强制倒计时期间按 SPACE 无效；
        // 倒计时结束后按 SPACE 进入下一组（无「继续休息」按钮，也无 ESC 退出）
        if (experimentPhase === 'break_wait' && (e.code === 'Space' || e.key === ' ')) {
            e.preventDefault();
            nextBlock();
        }
    }
});
// 将按下的字符转换为标签槽编号（1..nItems）；若该键本试次未显示则返回 0
function keyToLabelSlot(keyChar) {
    for (let i = 0; i < currentNItems; i++) {
        if (LABEL_CHARS[trialLabels[i]] === keyChar) return i + 1;
    }
    return 0;
}

// 为当前试次抽取标签字符的逻辑已并入 buildProbePlan（plan.trialLabels），
// 保证颜色、位置、标签三者来自同一次抽取，不会互相错位。

// ============================================================
//  练习阶段（20 trial，2 种 set size × 10，全部 change）
// ============================================================
let practiceTrials = [];
let practiceTrialIdx = 0;
let practiceAcc = [];

function startPractice() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let nPerSzPractice = prefs.nPractice / prefs.setSizes.length;
    practiceTrials = [];
    for (let ss of prefs.setSizes) {
        for (let i = 0; i < nPerSzPractice; i++) {
            practiceTrials.push({ setSize: ss, change: 1 }); // CLT 全部 change
        }
    }
    shuffleArray(practiceTrials);
    practiceTrialIdx = 0;
    practiceAcc = [];
    practiceData = [];

    switchScreen('experiment');
    runPracticeTrial();
}

let activeColors = [];
let activeLocs = [];
let trialData = {};
let practiceTrialData = {};
let responseStartTime = 0;

// CLT 专用：变化方块索引、新颜色、标签映射
// 这些全局量是「当前试次」的镜像，记录数据与按键判断用；
// 绘制一律走 trialPlan（见 buildProbePlan），不直接读这些全局量。
let changeItemIdx = 0;
let changeColorIdx = 0;
let labelMap = [];
let correctLabel = 0;

// --- 当前试次的「探测计划」---
// 记忆阵列颜色、探测阵列颜色、位置、标签全部由它一次算好并冻结。
// 这样探测阵列必定是「它自己那次记忆阵列」的唯一一个方块变色，
// 不可能出现两个（或更多）方块同时变色。
let trialPlan = null;
let probePlanViolations = 0;   // 自检失败计数，正常情况下恒为 0

// 自检：探测阵列相对记忆阵列必须有且只有一个方块变色，
// 且变化后的颜色不能是记忆阵列中出现过的颜色
function verifyProbePlan(plan) {
    let diff = [];
    for (let i = 0; i < plan.setSize; i++) {
        if (plan.probeColors[i] !== plan.memColors[i]) diff.push(i);
    }
    const onlyOneChanged = diff.length === 1 && diff[0] === plan.changeIdx;
    const newColorNotInMemory = !plan.memColors.includes(plan.probeColors[plan.changeIdx]);
    const colorReallyChanged = plan.probeColors[plan.changeIdx] !== plan.memColors[plan.changeIdx];
    const noDupInMemory = new Set(plan.memColors).size === plan.setSize;
    const ok = onlyOneChanged && newColorNotInMemory && colorReallyChanged && noDupInMemory;
    if (!ok) {
        probePlanViolations++;
        console.error('[CLT] 探测阵列自检未通过（不应发生）：', {
            diff: diff, memColors: plan.memColors, probeColors: plan.probeColors,
            changeIdx: plan.changeIdx, setSize: plan.setSize, violations: probePlanViolations
        });
    }
    return ok;
}

// 生成一次试次的完整视觉计划
//   记忆阵列：从 9 色调色板中不重复地随机取 setSize 个颜色
//   探测阵列：复制记忆阵列颜色，只把「变化方块」换成新颜色 → 恰好 1 个方块变色
//   新颜色  ：只能从「记忆阵列中没出现过的颜色」里挑，严格排除，无兜底放宽
function buildProbePlan(setSize) {
    let colorIndexArr = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    shuffleArray(colorIndexArr);
    const memColors = colorIndexArr.slice(0, setSize);

    const locs = getStimLocs(setSize, canvas.width / 2, canvas.height / 2);

    // 变化方块：随机 1 个
    const changeIdx = randInt(0, setSize - 1);

    // 新颜色：排除记忆阵列出现过的全部颜色
    let newColorPool = [];
    for (let c = 0; c < colors_9.length; c++) {
        if (!memColors.includes(c)) newColorPool.push(c);
    }
    if (newColorPool.length === 0) {
        // 调色板共 9 色、setSize 最大 6，实际不可能触发；
        // 保留防御但不放宽条件（绝不退回记忆阵列已用的颜色）
        throw new Error('buildProbePlan: 调色板颜色不足，无法选出不属于记忆阵列的新颜色');
    }
    const newColor = newColorPool[randInt(0, newColorPool.length - 1)];

    // 探测阵列颜色：仅替换变化方块那一项
    const probeColors = memColors.slice();
    probeColors[changeIdx] = newColor;

    // 标签映射：标签槽 i 显示在 labelMap[i] 对应的方块上方
    let lmap = [];
    for (let i = 0; i < setSize; i++) lmap.push(i);
    shuffleArray(lmap);

    // 标签字符：从 {1,2,3,8,9,0} 中随机取 setSize 个
    let charPool = [0, 1, 2, 3, 4, 5];
    shuffleArray(charPool);

    const plan = {
        setSize: setSize,
        locs: locs,
        memColors: memColors,           // 记忆阵列颜色
        probeColors: probeColors,       // 探测阵列颜色（恰好 1 项与 memColors 不同）
        changeIdx: changeIdx,           // 变化方块的索引
        origColor: memColors[changeIdx],// 变化方块原色
        newColor: newColor,             // 变化方块新色（不在 memColors 中）
        labelMap: lmap,
        trialLabels: charPool.slice(0, setSize),
        correctLabel: lmap.indexOf(changeIdx) + 1   // 正确反应 = 变色方块的标签槽编号
    };

    verifyProbePlan(plan);
    return plan;
}

// 把试次计划同步到全局镜像（记录数据 / 按键判断用；绘制不依赖这些全局量）
function applyPlanToGlobals(plan) {
    activeColors = plan.memColors.slice();
    activeLocs = plan.locs;
    changeItemIdx = plan.changeIdx;
    changeColorIdx = plan.newColor;
    labelMap = plan.labelMap.slice();
    trialLabels = plan.trialLabels.slice();
    correctLabel = plan.correctLabel;
    currentNItems = plan.setSize;
}

// 按指定颜色数组绘制当前计划的全部方块（记忆阵列 / 探测阵列共用）
function drawPlanSquares(plan, colorIdxArr) {
    for (let i = 0; i < plan.setSize; i++) {
        drawSquare(plan.locs[i].x, plan.locs[i].y, colors_9[colorIdxArr[i]]);
    }
}

async function runPracticeTrial() {
    if (practiceTrialIdx >= practiceTrials.length) {
        endPractice();
        return;
    }

    experimentPhase = 'practice_running';
    let condition = practiceTrials[practiceTrialIdx];
    currentNItems = condition.setSize;
    practiceTrialData = {
        block: 0, trial: practiceTrialIdx + 1,
        setSize: condition.setSize, isChange: 1
    };

    // ITI
    drawBackground(); drawFixation();
    await wait(prefs.ITI);

    await showStudyArrayPractice(condition);
}

async function showStudyArrayPractice(condition) {
    // 一次算好并冻结本试次的视觉计划：记忆阵列 / 探测阵列 / 位置 / 标签
    // 计划内已保证「有且只有一个方块变色」且「新颜色不在记忆阵列中出现」
    const plan = buildProbePlan(condition.setSize);
    trialPlan = plan;
    applyPlanToGlobals(plan);

    // 学习阵列（仅方块，无标签）
    drawBackground(); drawFixation();
    drawPlanSquares(plan, plan.memColors);
    await wait(prefs.studyDuration);

    // 保留间隔（注视点全程固定显示，不消失）
    drawBackground(); drawFixation();
    await wait(prefs.retentionInterval);

    // 探测阵列：直接用同一个 plan 的 probeColors，任何情况下都只有一个方块变色
    showTestArrayPractice(plan);
}

function showTestArrayPractice(plan) {
    drawBackground(); drawFixation();

    // 绘制全部方块（变化方块使用新颜色）
    drawPlanSquares(plan, plan.probeColors);

    // 绘制数字标签（标签槽 i 显示在 labelMap[i] 对应的方块上方）
    drawLabels(plan);

    experimentPhase = 'practice_response';
    responseStartTime = performance.now();
}

function recordPracticeResponse(responseNum, keyChar) {
    // 立即锁定反应阶段：防止按键重复 / 连击在同一试次内触发第二次响应
    if (experimentPhase !== 'practice_response') return;
    experimentPhase = 'practice_locked';

    let rt = (performance.now() - responseStartTime) / 1000;
    practiceTrialData.rt = rt;
    practiceTrialData.response = responseNum;          // 标签槽编号（1..nItems）
    practiceTrialData.responseKey = keyChar || LABEL_CHARS[trialLabels[responseNum - 1]];
    practiceTrialData.correctResponse = correctLabel;
    practiceTrialData.changeItem = changeItemIdx;
    practiceTrialData.origColorIdx = activeColors[changeItemIdx];
    practiceTrialData.probeColorIdx = changeColorIdx;
    practiceTrialData.labelMap = JSON.stringify(labelMap);
    practiceTrialData.trialLabels = JSON.stringify(trialLabels.map(i => LABEL_CHARS[i]));
    practiceTrialData.labelChars = LABEL_CHARS.join('');
    practiceTrialData.accuracy = (responseNum === correctLabel) ? 1 : 0;

    practiceAcc.push(practiceTrialData.accuracy);
    practiceData.push(Object.assign({}, practiceTrialData));

    drawBackground(); drawFixation();
    practiceTrialIdx++;
    setTimeout(() => runPracticeTrial(), 50);
}

function endPractice() {
    let accPct = Math.round(practiceAcc.reduce((a, b) => a + b, 0) / practiceAcc.length * 100);
    experimentPhase = 'practice_end';
    drawBackground();

    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText('练习结束', canvas.width / 2, canvas.height / 2 - 80);
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText(`正确率：${accPct}%`, canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '20px Inter, sans-serif';
    ctx.fillStyle = 'rgb(255,235,59)';
    ctx.fillText('按 空格键(Space) 开始正式实验', canvas.width / 2, canvas.height / 2 + 60);
}

// ============================================================
//  正式实验阶段
// ============================================================
function startFormal() {
    // 预生成 90 trial（SS4×45 + SS6×45，随机顺序），全部 change
    let allSS = [];
    let nEachSS = prefs.nEachSS;
    for (let ss of prefs.setSizes) {
        for (let i = 0; i < nEachSS; i++) allSS.push(ss);
    }
    shuffleArray(allSS);

    allFormalTrials = [];
    for (let b = 0; b < prefs.numBlocks; b++) {
        for (let t = 0; t < prefs.numTrials; t++) {
            let idx = b * prefs.numTrials + t;
            if (idx < allSS.length) {
                allFormalTrials.push({ setSize: allSS[idx], change: 1 });
            }
        }
    }

    currentBlock = 1;
    startBlock();
}

let allFormalTrials = [];
let formalTrialGlobalIdx = 0;

function startBlock() {
    blockTrials = allFormalTrials.slice(
        (currentBlock - 1) * prefs.numTrials,
        currentBlock * prefs.numTrials
    );
    currentTrial = 0;
    formalTrialGlobalIdx = (currentBlock - 1) * prefs.numTrials;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    switchScreen('experiment');
    runTrial();
}

async function runTrial() {
    if (currentTrial >= blockTrials.length) {
        endBlock();
        return;
    }

    experimentPhase = 'trial_running';
    let condition = blockTrials[currentTrial];
    currentNItems = condition.setSize;
    trialData = {
        subjectID: p.subjectID,
        experimentVersion: EXPERIMENT_VERSION,
        sessionID: SESSION_ID,
        subName: p.subName,
        block: currentBlock,
        trial: currentTrial + 1,
        setSize: condition.setSize,
        isChange: 1,
        experimentType: 'CLT',
        studyDuration: prefs.studyDuration,
        studyDurationActual: prefs.studyDuration,
        subGroup: p.subGroup,
        rndSeed: p.rndSeed,
        subGender: p.subGender,
        subAge: p.subAge,
        subIdCard: p.subIdCard,
        subPhone: p.subPhone
    };

    // ITI
    drawBackground(); drawFixation();
    await wait(prefs.ITI);

    await showStudyArray(condition);
}

async function showStudyArray(condition) {
    // 一次算好并冻结本试次的视觉计划：记忆阵列 / 探测阵列 / 位置 / 标签
    // 计划内已保证「有且只有一个方块变色」且「新颜色不在记忆阵列中出现」
    const plan = buildProbePlan(condition.setSize);
    trialPlan = plan;
    applyPlanToGlobals(plan);

    trialData.itemLocs = JSON.stringify(plan.locs.map(l => [Math.round(l.x), Math.round(l.y)]));
    trialData.itemColors = JSON.stringify(plan.memColors);

    // 学习阵列（仅方块，无标签）
    drawBackground(); drawFixation();
    drawPlanSquares(plan, plan.memColors);
    await wait(prefs.studyDuration);

    // 保留间隔（注视点全程固定显示，不消失）
    drawBackground(); drawFixation();
    await wait(prefs.retentionInterval);

    trialData.changeItem = plan.changeIdx;
    trialData.origColorIdx = plan.origColor;
    trialData.probeColorIdx = plan.newColor;
    trialData.labelMap = JSON.stringify(plan.labelMap);
    trialData.trialLabels = JSON.stringify(plan.trialLabels.map(i => LABEL_CHARS[i]));
    trialData.labelChars = LABEL_CHARS.join('');
    trialData.correctResponse = plan.correctLabel;

    // 探测阵列：直接用同一个 plan 的 probeColors，任何情况下都只有一个方块变色
    showTestArray(plan);
}

// 反应时限（4000 ms 内未反应记为超时）
const RESPONSE_LIMIT_MS = 4000;
let responseTimer = null;

function showTestArray(plan) {
    drawBackground(); drawFixation();

    // 绘制全部方块（变化方块使用新颜色）
    drawPlanSquares(plan, plan.probeColors);

    // 绘制数字标签
    drawLabels(plan);

    experimentPhase = 'trial_response';
    responseStartTime = performance.now();
    
    // 启动超时计时器
    responseTimer = setTimeout(() => {
        if (experimentPhase === 'trial_response') {
            handleTimeout();
        }
    }, RESPONSE_LIMIT_MS);
}

function handleTimeout() {
    // 超时处理：锁定反应阶段，记录超时试次
    if (experimentPhase !== 'trial_response') return;
    experimentPhase = 'trial_locked';
    
    trialData.rt = null;
    trialData.response = null;
    trialData.responseKey = null;
    trialData.accuracy = 0;
    trialData.timeout = true;
    trialData.TrialStatus = 'timeout';
    trialData.CountedInK = 0;
    
    stimData.push(Object.assign({}, trialData));
    
    drawBackground(); drawFixation();
    currentTrial++;
    formalTrialGlobalIdx++;
    setTimeout(() => runTrial(), 50);
}

function recordResponse(responseNum, keyChar) {
    // 立即锁定反应阶段：防止按键重复 / 连击在同一试次内触发第二次响应
    if (experimentPhase !== 'trial_response') return;
    experimentPhase = 'trial_locked';

    // 清除超时计时器（如果还在运行）
    if (responseTimer) {
        clearTimeout(responseTimer);
        responseTimer = null;
    }

    let rt = (performance.now() - responseStartTime) / 1000;
    trialData.rt = rt;
    trialData.response = responseNum;                  // 标签槽编号（1..nItems）
    trialData.responseKey = keyChar || LABEL_CHARS[trialLabels[responseNum - 1]];
    trialData.accuracy = (responseNum === correctLabel) ? 1 : 0;
    trialData.timeout = false;
    trialData.TrialStatus = 'valid';
    trialData.CountedInK = 1;

    // 记录正确按键
    trialData.correctKey = LABEL_CHARS[trialLabels[correctLabel - 1]];

    // 记录被试选择颜色与正确颜色的 RGB
    const clickedColorIdx = (responseNum !== null && responseNum >= 1 && responseNum <= currentNItems)
        ? activeColors[responseNum - 1]
        : null;
    const correctColorIdx = activeColors[changeItemIdx];
    trialData.responseColorIdx = clickedColorIdx;
    trialData.correctColorIdx = correctColorIdx;
    trialData.responseRGB = clickedColorIdx !== null ? colors_9[clickedColorIdx].join(',') : null;
    trialData.correctRGB = correctColorIdx !== null ? colors_9[correctColorIdx].join(',') : null;

    stimData.push(Object.assign({}, trialData));

    drawBackground(); drawFixation();
    currentTrial++;
    formalTrialGlobalIdx++;
    setTimeout(() => runTrial(), 50);
}

// ============================================================
//  Block 间休息（强制 ≥30 秒倒计时，倒计时结束后按 SPACE 进入下一组）
// ============================================================
let breakTimer = null;
const BREAK_MIN_SECONDS = 15;   // block 间强制休息至少 15 秒，与原始 exp1_clt 一致

// 计算某个 block 的正确率（%）
function blockAccuracyPct(blockNo) {
    let rows = stimData.filter(d => d.block === blockNo);
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, d) => s + d.accuracy, 0) / rows.length * 100);
}

// set size = 4 的平均正确率（%）；没有 SS4 数据时返回 null
function ss4AccuracyPct() {
    const rows = stimData.filter(d => d.setSize === 4);
    if (rows.length === 0) return null;
    return rows.reduce((s, d) => s + d.accuracy, 0) / rows.length * 100;
}

    // 低正确率标记：set size = 4 的平均正确率低于 50%
    // 只影响导出文件名（前面加 F），不改变实验流程
function computeLowAccuracyFlag() {
    const acc = ss4AccuracyPct();
    return acc !== null && acc < 50;
}

function endBlock() {
    const blockAcc = blockAccuracyPct(currentBlock);

    // 只统计正确率低于 50% 的 block 数量（写入结果表备查）。
    // 已取消「累计 2 个 block 低于 50% 自动结束实验」的规则：
    // 无论正确率高低，实验都完整跑完 4 个 block，低正确率只在导出文件名上加 F。
    if (blockAcc < 50) lowAccBlockCount++;

    if (currentBlock < prefs.numBlocks) {
        showBreakScreen(blockAcc);
    } else {
        finishExperiment();
    }
}

function showBreakScreen(blockAcc) {
    switchScreen('break');
    experimentPhase = 'break_countdown';
    document.getElementById('rest-acc').innerText = `您的正确率为 ${blockAcc}%`;
    startBreakCountdown();
}

// 强制休息倒计时（结束后显示等待提示，按 SPACE 进入下一组）
function startBreakCountdown() {
    clearInterval(breakTimer);
    breakTimer = null;

    const cdEl = document.getElementById('rest-countdown');
    const waitEl = document.getElementById('rest-wait');
    let timeLeft = Math.max(BREAK_MIN_SECONDS, Math.round(prefs.breakLength * 60));

    experimentPhase = 'break_countdown';
    cdEl.innerText = timeLeft;
    cdEl.classList.remove('hidden');
    waitEl.classList.add('hidden');

    breakTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(breakTimer);
            breakTimer = null;
            cdEl.classList.add('hidden');
            waitEl.classList.remove('hidden');
            experimentPhase = 'break_wait';   // 此时按 SPACE 进入下一组
        } else {
            cdEl.innerText = timeLeft;
        }
    }, 1000);
}

// “继续休息 30 秒”按钮与其 ESC 退出实验功能已删除：
// 倒计时结束后只有「按 SPACE 进入下一组」一种操作。

function nextBlock() {
    clearInterval(breakTimer);
    breakTimer = null;
    currentBlock++;
    startBlock();
}

// 保存前统一补齐被试信息（保证每一行都带完整的被试信息）
function enrichRows(rows) {
    for (let d of rows) {
        d.subName = p.subName;
        d.subGender = p.subGender;
        d.subAge = p.subAge;
        d.subIdCard = maskIdCard(p.subIdCard); // 导出掩蔽后的身份证号
        d.subPhone = p.subPhone;
        d.subjectID = p.subjectID;
        d.rndSeed = p.rndSeed;
    }
    return rows;
}

// ============================================================
//  数据保存
// ============================================================
// 兜底列：若服务器数据表尚未包含 CLT 新增列，剔除后重试一次
const BASE_COLUMNS = [
    'subjectID', 'sessionID', 'experimentVersion', 'subName', 'subGender', 'subAge', 'subIdCard', 'subPhone',
    'block', 'trial', 'TrialGlobal', 'setSize', 'studyDuration', 'studyDurationActual',
    'isChange', 'experimentType', 'subGroup', 'Order',
    'rt', 'response', 'responseLabel', 'accuracy', 'correctResponse', 'correctResponseLabel',
    'TrialStatus', 'CountedInK', 'rndSeed', 'resumedFromBlock', 'resumeCount',
    'changeItem', 'origColorIdx', 'probeColorIdx', 'itemLocs', 'itemColors', 'labelMap'
];
function stripToBaseColumns(row) {
    const out = {};
    for (const k of BASE_COLUMNS) if (row[k] !== undefined) out[k] = row[k];
    return out;
}

async function finishExperiment() {
    switchScreen('upload');
    experimentPhase = 'upload';

    let uploadMsg = "";
    let uploadFailed = false;

    enrichRows(stimData);

    if (supabaseClient && stimData.length > 0) {
        try {
            const { error } = await supabaseClient.from('vwm_data').insert(stimData);
            if (error) throw error;
            uploadMsg += "数据上传服务器成功。";
        } catch (error) {
            console.error("Supabase Error:", error);
            // 兼容旧表结构：剔除 CLT 新增列后重试
            try {
                const { error: retryError } = await supabaseClient
                    .from('vwm_data').insert(stimData.map(stripToBaseColumns));
                if (retryError) throw retryError;
                uploadMsg += "数据上传服务器成功（按基础字段）。";
            } catch (retryErr) {
                console.error("Supabase Retry Error:", retryErr);
                uploadFailed = true;
                uploadMsg += "服务器上传失败: " + retryErr.message + "。";
            }
        }
    } else if (!supabaseClient) {
        uploadFailed = true;
        uploadMsg += "未配置服务器上传。";
    }

    if (p.saveLocal && stimData.length > 0) {
        try {
            downloadXLSX();
            uploadMsg += "本地 Excel 已生成下载。";
        } catch (e) {
            console.error('[CLT] 本地导出失败:', e);
            uploadFailed = true;
            uploadMsg += "本地 Excel 导出失败：" + e.message + "。";
        }
    }

    document.getElementById('upload-status').innerText = uploadMsg;

    // 结束语画面保持干净：仅在异常时显示状态说明
    const statusEl = document.getElementById('finished-text');
    if (statusEl) {
        if (uploadFailed) {
            statusEl.innerText = uploadMsg;
            statusEl.classList.remove('hidden');
        } else {
            statusEl.innerText = '';
            statusEl.classList.add('hidden');
        }
    }

    setTimeout(() => { switchScreen('finished'); }, 2000);

    try { if (document.exitFullscreen) document.exitFullscreen(); } catch (e) {}
}

// ============================================================
//  导出列规范（ASCII 列名，方便 R readxl 直接读入）
//  与 exp1_clt 系列保持一致，便于多范式数据合并后统一建模
// ============================================================
const TRIAL_EXPORT_COLUMNS = [
    { header: 'SubjectID',          text: true, get: (d) => d.subjectID || p.subjectID },
    { header: 'SessionID',          text: true, get: (d) => d.sessionID || SESSION_ID },
    { header: 'ExperimentVersion',  text: true, get: (d) => d.experimentVersion || EXPERIMENT_VERSION },
    { header: 'ExperimentType',    text: true, get: (d) => d.experimentType || 'CLT' },
    { header: 'subGroup',                         get: (d) => exportNum(d.subGroup !== undefined ? d.subGroup : p.subGroup) },
    { header: 'Block',                         get: (d) => exportNum(d.block) },
    { header: 'TrialInBlock',                  get: (d) => exportNum(d.trial) },
    { header: 'TrialGlobal',                   get: (d) => exportNum(d.TrialGlobal) },
    { header: 'SetSize',                       get: (d) => exportNum(d.setSize) },
    { header: 'StudyDuration',                 get: (d) => exportNum(d.studyDuration) },
    { header: 'Condition',         text: true, get: (d) => conditionLabel(d.setSize) },
    { header: 'Accuracy',                      get: (d) => exportNum(d.accuracy) },
    { header: 'RT',                            get: (d) => (typeof d.rt === 'number' ? Number(d.rt.toFixed(4)) : null) },
    { header: 'ResponseKey',          text: true, get: (d) => d.responseKey },
    { header: 'CorrectKey',           text: true, get: (d) => d.correctKey },
    { header: 'ResponseRGB',          text: true, get: (d) => d.responseRGB },
    { header: 'CorrectRGB',           text: true, get: (d) => d.correctRGB },
    { header: 'ResponseColorIdx',               get: (d) => exportNum(d.responseColorIdx) },
    { header: 'CorrectColorIdx',                get: (d) => exportNum(d.correctColorIdx) },
    { header: 'TrialStatus',        text: true, get: (d) => d.TrialStatus || (d.timeout ? 'timeout' : 'valid') },
    { header: 'CountedInK',                   get: (d) => exportNum(d.CountedInK) },
    { header: 'StudyDurationActual',           get: (d) => exportNum(d.studyDurationActual) },
    { header: 'SubName',           text: true, get: (d) => d.subName || p.subName },
    { header: 'SubGender',         text: true, get: (d) => d.subGender || p.subGender },
    { header: 'SubAge',                        get: (d) => exportNum(d.subAge !== undefined ? d.subAge : p.subAge) },
    { header: 'SubIdCard',         text: true, get: (d) => maskIdCard(d.subIdCard || p.subIdCard || '') },
    { header: 'SubPhone',          text: true, get: (d) => d.subPhone || p.subPhone },
    { header: 'RandomSeed',        text: true, get: (d) => d.rndSeed !== undefined ? d.rndSeed : p.rndSeed },
    { header: 'ChangeItem',                    get: (d) => exportNum(d.changeItem) },
    { header: 'OrigColorIdx',                  get: (d) => exportNum(d.origColorIdx) },
    { header: 'ProbeColorIdx',                 get: (d) => exportNum(d.probeColorIdx) },
    { header: 'ItemLocs',          text: true, get: (d) => d.itemLocs },
    { header: 'ItemColors',        text: true, get: (d) => d.itemColors },
    { header: 'LabelMap',          text: true, get: (d) => d.labelMap },
    { header: 'TrialLabels',       text: true, get: (d) => d.trialLabels },
    { header: 'LabelChars',        text: true, get: (d) => d.labelChars }
];

const K_EXPORT_COLUMNS = [
    'SubjectID', 'SessionID', 'ExperimentVersion', 'ExperimentType', 'subGroup', 'SetSize', 'StudyDuration', 'Condition',
    'TotalTrials', 'ValidTrials', 'TimeoutTrials', 'TimeoutExclusionRate',
    'CorrectTrials', 'Accuracy_Exclude', 'K_Exclude',
    'Accuracy_TimeoutErr', 'K_TimeoutErr', 'MeanRT',
    'LowAccFlag', 'LowAccBlockCount'
];
const K_TEXT_COLUMNS = new Set(['SubjectID', 'ExperimentType', 'Condition']);

// 超时排除开关：true = 剔除 timeout 试次后再算 K（主口径）
const EXCLUDE_TIMEOUT_FROM_K = true;

function sheetFromColumns(rows, columns) {
    const headers = columns.map(c => c.header);
    const data = rows.map(d => {
        const out = {};
        for (const col of columns) {
            const v = col.get(d);
            if (v === null || v === undefined || v === '') continue;
            out[col.header] = col.text ? String(v) : v;
        }
        return out;
    });
    return XLSX.utils.json_to_sheet(data, { header: headers });
}

function kSheetFromRows(rows) {
    const data = rows.map(r => {
        const out = {};
        for (const header of K_EXPORT_COLUMNS) {
            const v = r[header];
            if (v === null || v === undefined || v === '') continue;
            if (K_TEXT_COLUMNS.has(header)) { out[header] = String(v); continue; }
            const n = Number(v);
            if (Number.isFinite(n)) out[header] = n;
        }
        return out;
    });
    return XLSX.utils.json_to_sheet(data, { header: K_EXPORT_COLUMNS });
}

// 构造一行 K 值统计（CLT 公式: K = (Acc * N^2 - N) / (N - 1)）
// 同时报告两种口径：
//   Accuracy_Exclude / K_Exclude        ：超时剔除（主口径）
//   Accuracy_TimeoutErr / K_TimeoutErr ：超时按错误计入（备选口径）
function buildKRow(setSize, rows) {
    const nTotal = rows.length;
    const validRows = EXCLUDE_TIMEOUT_FROM_K
        ? rows.filter(d => d.CountedInK === 1 && d.timeout !== true)
        : rows;
    const nValid = validRows.length;
    const nTimeout = nTotal - nValid;
    const nCorrect = validRows.filter(d => d.accuracy === 1).length;
    const acc = nValid > 0 ? nCorrect / nValid : 0;

    const validRTs = validRows.filter(d => typeof d.rt === 'number').map(d => d.rt);
    const rtMean = validRTs.length > 0
        ? validRTs.reduce((s, v) => s + v, 0) / validRTs.length
        : '';

    const N = setSize;
    const K = N > 1 ? (acc * N * N - N) / (N - 1) : '';

    // 备选口径：timeout 按错误计入
    const nCorrectAll = rows.filter(d => d.accuracy === 1).length;
    const accAll = nTotal > 0 ? nCorrectAll / nTotal : 0;
    const KAll = N > 1 ? (accAll * N * N - N) / (N - 1) : '';

    return {
        SubjectID: p.subjectID,
        SessionID: SESSION_ID,
        ExperimentVersion: EXPERIMENT_VERSION,
        ExperimentType: 'CLT',
        subGroup: p.subGroup,
        SetSize: setSize,
        StudyDuration: '',   // CLT 固定 250ms，汇总行无单一时长，留空
        Condition: conditionLabel(setSize),
        TotalTrials: nTotal,
        ValidTrials: nValid,
        TimeoutTrials: nTimeout,
        TimeoutExclusionRate: nTotal > 0 ? Math.round(nTimeout / nTotal * 10000) / 10000 : '',
        CorrectTrials: nCorrect,
        Accuracy_Exclude: Math.round(acc * 10000) / 10000,
        K_Exclude: K === '' ? '' : Math.round(K * 10000) / 10000,
        Accuracy_TimeoutErr: Math.round(accAll * 10000) / 10000,
        K_TimeoutErr: KAll === '' ? '' : Math.round(KAll * 10000) / 10000,
        MeanRT: rtMean === '' ? '' : Math.round(rtMean * 10000) / 10000,
        LowAccFlag: ss4LowAccuracyFlag && setSize === 4 ? 1 : 0,
        LowAccBlockCount: lowAccBlockCount
    };
}

// 标红低正确率条件行（XLSX 0.18.5 无样式能力时为 no-op）
function markKRowsRed(sheet) {
    // XLSX 社区版不支持样式，空操作保留接口
}

// 补全被试信息与断点续做标记，保证 Trial Data 每行都带被试级字段
function enrichRows(rows) {
    for (const d of rows) {
        d.subjectID = p.subjectID;
        d.subName = p.subName;
        d.subGender = p.subGender;
        d.subAge = p.subAge;
        d.subIdCard = p.subIdCard;
        d.subPhone = p.subPhone;
        d.rndSeed = p.rndSeed;
        d.subGroup = p.subGroup;
        d.experimentType = 'CLT';
    }
}

// 按「set size」分组重排试次（同一条件的试次连续排列）
function groupTrialsByCondition(rows) {
    const sorted = rows.slice().sort((a, b) => {
        if (a.setSize !== b.setSize) return a.setSize - b.setSize;
        return (a.block * 100 + a.trial) - (b.block * 100 + b.trial);
    });
    let idx = 0;
    for (const d of sorted) {
        d.GroupIndex = idx;
        d.GroupLabel = conditionLabel(d.setSize);
        if (d.setSize !== sorted[idx - 1]?.setSize) idx++;
    }
    return sorted;
}

// 强制将指定列的单元格设为文本类型（避免 Excel 自动转换数字/日期）
function forceTextCells(sheet, headers, textCols) {
    if (!sheet || !sheet['!ref']) return;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) {
        const header = headers[c];
        if (!textCols.includes(header)) continue;
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[addr];
            if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;
            cell.t = 's';
            cell.v = String(cell.v);
            cell.z = '@';
            delete cell.w;
        }
    }
}

function downloadXLSX() {
    if (stimData.length === 0) return;

    // 低正确率标记：set size = 4 的平均正确率 < 50% → 导出文件名前面加 F
    ss4LowAccuracyFlag = computeLowAccuracyFlag();

    // 补全被试信息与断点续做标记，保证 Trial Data 每行都带被试级字段
    enrichRows(stimData);

    // 全局试次序号（1..N）：长格式里用来查顺序效应 / 疲劳效应
    stimData.forEach((d, i) => { d.TrialGlobal = i + 1; });

    // ============================================================
    //  Sheet 1: Trial Data
    //  长格式，一行一试次；列顺序与含义见上方「导出列规范」
    // ============================================================
    const trialSheet = sheetFromColumns(stimData, TRIAL_EXPORT_COLUMNS);

    // ============================================================
    //  Sheet 2: K Values（条件级，按 set size 各一行）
    //  CLT 公式: K = (Acc * N^2 - N) / (N - 1)
    //  同时报告两种口径：
    //    Accuracy_Exclude / K_Exclude        ：超时剔除（主口径）
    //    Accuracy_TimeoutErr / K_TimeoutErr ：超时按错误计入（备选口径）
    //  TimeoutExclusionRate 报告每个条件被剔除的超时比例。
    // ============================================================
    const kData = [];
    for (const ss of prefs.setSizes.slice().sort((a, b) => a - b)) {
        const rows = stimData.filter(d => Number(d.setSize) === ss);
        kData.push(buildKRow(ss, rows));
    }
    const kSheet = kSheetFromRows(kData);
    markKRowsRed(kSheet);

    // ============================================================
    //  Sheet 3: ColorAccuracy（每个颜色在每个 set size 下的反应正确率）
    //  行：颜色 RGB；列：set size；值：该颜色作为正确选项时的正确率
    // ============================================================
    const colorAccData = [];
    const sortedSetSizes = prefs.setSizes.slice().sort((a, b) => a - b);
    for (const ss of sortedSetSizes) {
        const ssRows = stimData.filter(d => Number(d.setSize) === ss);
        for (let c = 0; c < colors_9.length; c++) {
            const colorRows = ssRows.filter(d => Number(d.correctColorIdx) === c);
            const nTotal = colorRows.length;
            const nCorrect = colorRows.filter(d => d.accuracy === 1).length;
            const acc = nTotal > 0 ? nCorrect / nTotal : null;
            colorAccData.push({
                SetSize: ss,
                ColorIdx: c,
                RGB: colors_9[c].join(','),
                TotalTrials: nTotal,
                CorrectTrials: nCorrect,
                Accuracy: acc
            });
        }
    }
    const colorAccSheet = XLSX.utils.json_to_sheet(colorAccData, {
        header: ['SetSize', 'ColorIdx', 'RGB', 'TotalTrials', 'CorrectTrials', 'Accuracy']
    });

    // ============================================================
    //  Sheet 4: Grouped Trials
    //  列与 Sheet1 完全相同，但按「set size」分组重排：同一条件的试次在表中连续排列
    // ============================================================
    const groupedColumns = [
        { header: 'GroupIndex', get: (d) => exportNum(d.GroupIndex) },
        { header: 'GroupLabel', text: true, get: (d) => d.GroupLabel }
    ].concat(TRIAL_EXPORT_COLUMNS);
    const groupedSheet = sheetFromColumns(groupTrialsByCondition(stimData), groupedColumns);

    // === 生成 Excel 文件 ===
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, trialSheet, 'Trial Data');
    XLSX.utils.book_append_sheet(wb, kSheet, 'K Values');
    XLSX.utils.book_append_sheet(wb, colorAccSheet, 'ColorAccuracy');
    XLSX.utils.book_append_sheet(wb, groupedSheet, 'Grouped Trials');

    // 文本列保护：SubjectID / ResponseKey / CorrectKey / ResponseRGB / CorrectRGB 等按文本写入
    const textCols = ['SubjectID', 'CorrectKey', 'ResponseKey', 'ResponseRGB', 'CorrectRGB', 'SubName', 'SubIdCard', 'SubPhone', 'LabelMap', 'TrialLabels', 'LabelChars', 'ItemLocs', 'ItemColors'];
    forceTextCells(trialSheet, TRIAL_EXPORT_COLUMNS.map(c => c.header), textCols);
    forceTextCells(kSheet, K_EXPORT_COLUMNS, ['SubjectID', 'ExperimentType', 'Condition']);
    forceTextCells(groupedSheet, groupedColumns.map(c => c.header), textCols);

    // 文件名：正式实验 = 实验名称_被试编号；SS4 正确率 < 50% 时前面加 F；调试模式固定 1111.xlsx
    const filePrefix = (!p.debugMode && ss4LowAccuracyFlag) ? 'F' : '';
    const fileName = filePrefix + 'exp1_clt_' + p.subjectID + '.xlsx';
    console.log(`[CLT] 导出模式=${p.debugMode ? '调试' : '正式'} 被试编号=${p.subjectID}` +
        ` SS4平均正确率=${ss4AccuracyPct() === null ? '无数据' : ss4AccuracyPct().toFixed(1) + '%'}` +
        ` 文件名=${fileName}`);
    saveWorkbookFile(wb, fileName);
}

// ============================================================
//  写出 Excel 文件
//  用正确的 xlsx MIME + 明确的文件名触发下载；同时在结束界面保留一个
//  手动下载链接（某些浏览器/内嵌预览不遵循 download 属性，会把文件存成
//  随机名或没有扩展名，看起来「不是 Excel 文件」，此时可用该链接另存）
// ============================================================
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let lastExport = null;   // { url, fileName, size }

function saveWorkbookFile(wb, fileName) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Excel 导出库 (xlsx) 未加载');
    }
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
    // 校验 zip 魔数 'PK'，确保写出的是合法 xlsx（而不是被当成其它格式）
    if (u8[0] !== 0x50 || u8[1] !== 0x4B) {
        throw new Error('生成的 Excel 内容异常');
    }

    const blob = new Blob([u8], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    lastExport = { url: url, fileName: fileName, size: u8.length };

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log(`[CLT] 已导出 ${fileName}（${u8.length} 字节，${wb.SheetNames.length} 个 sheet）`);
    showManualDownload(fileName, url);
}

// 结束界面上的手动下载入口（文件名与自动下载一致）
function showManualDownload(fileName, url) {
    const box = document.getElementById('manual-download');
    if (!box) return;
    const link = document.getElementById('manual-download-link');
    if (link) {
        link.href = url;
        link.download = fileName;
        link.innerText = fileName;
    }
    box.classList.remove('hidden');
}

// ============================================================
//  Canvas 绘图工具
// ============================================================
function drawBackground() {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFixation() {
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, prefs.fixationSize, 0, Math.PI * 2);
    ctx.fill();
}

function drawSquare(x, y, colorArr) {
    ctx.fillStyle = `rgb(${colorArr[0]},${colorArr[1]},${colorArr[2]})`;
    const half = prefs.stimSize / 2;
    ctx.fillRect(x - half, y - half, prefs.stimSize, prefs.stimSize);
}

// CLT 专用：绘制数字标签
// 标签槽 i（1-indexed）显示字符 LABEL_CHARS[plan.trialLabels[i-1]]，
// 绘制在 plan.labelMap[i-1] 对应的方块上方
// 位置与标签都取自试次计划，保证与记忆阵列、探测阵列严格对应
function drawLabels(plan) {
    ctx.fillStyle = 'rgb(64,64,64)';
    ctx.font = `bold ${prefs.labelFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < plan.setSize; i++) {
        let itemIdx = plan.labelMap[i];
        let lx = plan.locs[itemIdx].x;
        let ly = plan.locs[itemIdx].y - prefs.stimSize / 2 - prefs.labelFontSize;
        ctx.fillText(LABEL_CHARS[plan.trialLabels[i]], lx, ly);
    }
}

// ============================================================
//  getStimLocs — 与原始 exp1_clt 相同的固定半径位置生成
// ============================================================
function getStimLocs(nItems, cx, cy) {
    const S = prefs.stimSize;
    // 原始 exp1_clt：以 768 px 短边为参考，刺激中心半径 200 px；
    // 在不同窗口尺寸下按画布短边同比例缩放，保持视觉尺度一致。
    const shortSide = Math.min(canvas.width, canvas.height);
    const stimulusCircleRadius = shortSide * (200 / 768);
    let minR = stimulusCircleRadius;
    let maxR = stimulusCircleRadius;
    maxR = Math.min(maxR, shortSide / 2 - S);
    minR = Math.max(minR, S * 2.0);

    const minDist = S * 2.5;
    const relaxDist = S * 2.0;
    const axisMargin = 20 * Math.PI / 180;

    const quadPatterns6 = [
        [2,2,1,1], [1,2,1,2], [1,1,2,2], [1,2,2,1], [2,1,1,2], [2,1,2,1]
    ];

    let perQuad;
    if (nItems === 4) {
        perQuad = [1, 1, 1, 1];
    } else if (nItems === 6) {
        perQuad = quadPatterns6[randInt(0, 5)];
    } else {
        throw new Error('getStimLocs: nItems must be 4 or 6, got ' + nItems);
    }

    const qLo = [
        axisMargin, Math.PI / 2 + axisMargin,
        Math.PI + axisMargin, 3 * Math.PI / 2 + axisMargin
    ];
    const qHi = [
        Math.PI / 2 - axisMargin, Math.PI - axisMargin,
        3 * Math.PI / 2 - axisMargin, 2 * Math.PI - axisMargin
    ];

    const nCandidates = 30;
    let bestScore = -Infinity;
    let bestXPos = [], bestYPos = [];

    for (let cand = 0; cand < nCandidates; cand++) {
        let xPos_c = new Array(nItems).fill(0);
        let yPos_c = new Array(nItems).fill(0);
        let idx = 0;

        for (let q = 0; q < 4; q++) {
            const k = perQuad[q];
            if (k === 0) continue;
            const qRange = qHi[q] - qLo[q];

            for (let i = 0; i < k; i++) {
                let thetaC, subLo, subHi;
                if (k === 1) {
                    thetaC = qLo[q] + qRange * 0.5;
                    let jit = qRange * 0.15 * (random() - 0.5) * 2;
                    subLo = thetaC + jit - qRange * 0.05;
                    subHi = thetaC + jit + qRange * 0.05;
                } else {
                    thetaC = qLo[q] + qRange * (0.15 + 0.70 * i / (k - 1));
                    let jit = qRange * 0.05 * (random() - 0.5) * 2;
                    subLo = thetaC + jit - qRange * 0.03;
                    subHi = thetaC + jit + qRange * 0.03;
                }

                let placed = false;

                for (let att = 0; att < 500 && !placed; att++) {
                    let r = minR + (maxR - minR) * Math.sqrt(random());
                    let theta = subLo + (subHi - subLo) * random();
                    let xi = cx + r * Math.cos(theta);
                    let yi = cy + r * Math.sin(theta);
                    if (Math.abs(xi - cx) < S || Math.abs(yi - cy) < S) continue;
                    let tooClose = false;
                    for (let j = 0; j < idx; j++) {
                        if (Math.hypot(xi - xPos_c[j], yi - yPos_c[j]) < minDist) { tooClose = true; break; }
                    }
                    if (!tooClose) { xPos_c[idx] = xi; yPos_c[idx] = yi; placed = true; }
                }

                if (!placed) {
                    for (let att = 0; att < 800 && !placed; att++) {
                        let r = minR + (maxR - minR) * Math.sqrt(random());
                        let theta = qLo[q] + qRange * random();
                        let xi = cx + r * Math.cos(theta);
                        let yi = cy + r * Math.sin(theta);
                        if (Math.abs(xi - cx) < S || Math.abs(yi - cy) < S) continue;
                        let tooClose = false;
                        for (let j = 0; j < idx; j++) {
                            if (Math.hypot(xi - xPos_c[j], yi - yPos_c[j]) < minDist) { tooClose = true; break; }
                        }
                        if (!tooClose) { xPos_c[idx] = xi; yPos_c[idx] = yi; placed = true; }
                    }
                }

                if (!placed) {
                    for (let att = 0; att < 1000 && !placed; att++) {
                        let r = minR + (maxR - minR) * Math.sqrt(random());
                        let theta = qLo[q] + qRange * random();
                        let xi = cx + r * Math.cos(theta);
                        let yi = cy + r * Math.sin(theta);
                        if (Math.abs(xi - cx) < S || Math.abs(yi - cy) < S) continue;
                        let tooClose = false;
                        for (let j = 0; j < idx; j++) {
                            if (Math.hypot(xi - xPos_c[j], yi - yPos_c[j]) < relaxDist) { tooClose = true; break; }
                        }
                        if (!tooClose) { xPos_c[idx] = xi; yPos_c[idx] = yi; placed = true; }
                    }
                }

                if (!placed) {
                    let bestMinD = -1, bestXi = 0, bestYi = 0;
                    for (let att = 0; att < 2000; att++) {
                        let r = minR + (maxR - minR) * Math.sqrt(random());
                        let theta = qLo[q] + qRange * random();
                        let xi = cx + r * Math.cos(theta);
                        let yi = cy + r * Math.sin(theta);
                        if (Math.abs(xi - cx) < S || Math.abs(yi - cy) < S) continue;
                        let minD = Infinity;
                        for (let j = 0; j < idx; j++) {
                            let d = Math.hypot(xi - xPos_c[j], yi - yPos_c[j]);
                            if (d < minD) minD = d;
                        }
                        if (minD > bestMinD) { bestMinD = minD; bestXi = xi; bestYi = yi; }
                    }
                    xPos_c[idx] = bestXi; yPos_c[idx] = bestYi;
                }
                idx++;
            }
        }

        let dists = [];
        for (let a = 0; a < nItems - 1; a++) {
            for (let b = a + 1; b < nItems; b++) {
                dists.push(Math.hypot(xPos_c[a] - xPos_c[b], yPos_c[a] - yPos_c[b]));
            }
        }
        let angles = [];
        for (let i = 0; i < nItems; i++) {
            angles.push(Math.atan2(yPos_c[i] - cy, xPos_c[i] - cx));
        }
        angles = angles.map(a => (a + 2 * Math.PI) % (2 * Math.PI));
        angles.sort((a, b) => a - b);
        let angularGaps = [];
        for (let i = 0; i < nItems; i++) {
            let next = i < nItems - 1 ? angles[i + 1] : angles[0] + 2 * Math.PI;
            angularGaps.push(next - angles[i]);
        }

        let minD = Math.min(...dists);
        let meanD = dists.reduce((s, d) => s + d, 0) / dists.length;
        let stdD = Math.sqrt(dists.reduce((s, d) => s + (d - meanD) ** 2, 0) / (dists.length - 1));
        let meanG = angularGaps.reduce((s, g) => s + g, 0) / angularGaps.length;
        let stdG = Math.sqrt(angularGaps.reduce((s, g) => s + (g - meanG) ** 2, 0) / (angularGaps.length - 1));

        let score = minD - 0.4 * stdD - 40 * stdG;
        if (score > bestScore) {
            bestScore = score;
            bestXPos = [...xPos_c];
            bestYPos = [...yPos_c];
        }
    }

    let locs = [];
    for (let i = 0; i < nItems; i++) {
        locs.push({ x: bestXPos[i], y: bestYPos[i] });
    }
    return locs;
}
