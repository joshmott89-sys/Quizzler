/* ═══════════════════════════════════════
   THE QUIZZLER — app.js (v1.0 Production)
   Dynamic AI Lore, Prefetching, Best-of-5
═══════════════════════════════════════ */

'use strict';

let audioCtx = null;
function initAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSensoryFeedback(isCorrect) {
  if (navigator.vibrate) navigator.vibrate(isCorrect ? [100] : [300, 100, 300]);
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator(), gainNode = audioCtx.createGain();
  osc.connect(gainNode); gainNode.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (isCorrect) {
    osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gainNode.gain.setValueAtTime(1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    gainNode.gain.setValueAtTime(1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  }
}
/* ───────────────────────────────────────
   API CONFIGURATION
─────────────────────────────────────── */
const GEMINI_ENDPOINT = "https://star-wars-quiz-proxy.joshmott89.workers.dev";

// Note: The GEMINI_API_KEY variable is completely deleted!


const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const gameState = { currentLevel: 1, score: 0, levelAnswered: 0, levelCorrect: 0, usedQuestions: [], allQuestions: {}, allData: {}, currentQuestionText: "", currentQuestionObj: null };

const DOM = {
  startScreen: document.getElementById('start-screen'), quizScreen: document.getElementById('quiz-screen'), transitionScreen: document.getElementById('transition-screen'), endScreen: document.getElementById('end-screen'),
  beginBtn: document.getElementById('begin-btn'), hudScore: document.getElementById('hud-score'), hudStreak: document.getElementById('hud-streak'), hudLevel: document.getElementById('hud-level'),
  questionText: document.getElementById('question-text'), answersGrid: document.getElementById('answers-grid'), hintBtn: document.getElementById('hint-btn'),
  transitionMsg: document.getElementById('transition-message'), transitionXP: document.getElementById('transition-xp'), finalScore: document.getElementById('final-score'), restartBtn: document.getElementById('restart-btn'),
  mediaModal: document.getElementById('media-modal'), modalBox: document.getElementById('modal-box'), modalIframe: document.getElementById('modal-iframe'), modalImg: document.getElementById('modal-img'), modalCloseBtn: document.getElementById('modal-close-btn'),
};

function showView(viewEl) { [DOM.startScreen, DOM.quizScreen, DOM.transitionScreen, DOM.endScreen].forEach(v => v.classList.toggle('hidden', v !== viewEl)); }
function updateHUD() { DOM.hudScore.textContent = `Score: ${gameState.score}`; DOM.hudStreak.textContent = `Progress: ${gameState.levelAnswered}/5 🔥`; DOM.hudLevel.textContent = `Level: ${gameState.currentLevel}`; }

async function loadData() {
  try { if (typeof quizData === 'undefined') throw new Error("quizData missing."); gameState.allData = quizData; gameState.allQuestions = quizData.questions || {}; } 
  catch (err) { console.error('Data load failed:', err.message); }
}

function openYodaModal(text) {
  DOM.modalIframe.classList.add('hidden'); DOM.modalIframe.src = '';
  const mb = document.getElementById('mermaid-box'); if (mb) mb.remove();
  DOM.modalImg.src = 'https://upload.wikimedia.org/wikipedia/en/9/9b/Yoda_Empire_Strikes_Back.png';
  DOM.modalImg.style.filter = "sepia(1) hue-rotate(180deg) saturate(300%) opacity(0.7) drop-shadow(0 0 10px #00ffff)"; DOM.modalImg.classList.remove('hidden');
  let yodaTextEl = document.getElementById('yoda-text');
  if (!yodaTextEl) { yodaTextEl = document.createElement('p'); yodaTextEl.id = 'yoda-text'; yodaTextEl.style.color = '#8bc34a'; yodaTextEl.style.fontStyle = 'italic'; yodaTextEl.style.textAlign = 'center'; yodaTextEl.style.marginTop = '1rem'; yodaTextEl.style.lineHeight = '1.5'; DOM.modalBox.appendChild(yodaTextEl); }
  yodaTextEl.textContent = text; DOM.mediaModal.classList.remove('hidden');
}

function openMermaidModal(diagramCode) {
  DOM.modalIframe.classList.add('hidden'); DOM.modalIframe.src = ''; DOM.modalImg.classList.add('hidden');
  const yodaTextEl = document.getElementById('yoda-text'); if (yodaTextEl) yodaTextEl.textContent = '';
  let mermaidBox = document.getElementById('mermaid-box');
  if (!mermaidBox) { mermaidBox = document.createElement('div'); mermaidBox.id = 'mermaid-box'; mermaidBox.className = 'mermaid'; DOM.modalBox.appendChild(mermaidBox); }
  mermaidBox.textContent = diagramCode;
  try { if (typeof mermaid !== 'undefined') mermaid.init(undefined, document.querySelectorAll('#mermaid-box')); else throw new Error("Mermaid.js script not loaded."); } 
  catch (err) { mermaidBox.style.color = "var(--sith-red)"; mermaidBox.textContent = "⚠️ The Jedi Archives corrupted this holocron: " + err.message; }
  DOM.mediaModal.classList.remove('hidden');
}

function closeMediaModal() {
  DOM.modalIframe.src = ''; DOM.modalImg.src = ''; DOM.mediaModal.classList.add('hidden');
  const yodaTextEl = document.getElementById('yoda-text'); if (yodaTextEl) yodaTextEl.textContent = '';
  const mb = document.getElementById('mermaid-box'); if (mb) mb.remove();
}

async function generateDynamicDiagram(lore, btnElement) {
  if (!lore) return; btnElement.textContent = "Accessing Archives..."; btnElement.disabled = true;
  try {
    const promptText = `You are a Star Wars Historian. Create a 'graph TD' Mermaid diagram for: '${lore}'. CRITICAL: 1. Do NOT include UI text. 2. Focus ONLY on facts. 3. Use alphanumeric IDs. 4. No markdown.`;
    const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
    const data = await response.json();
    let cleanCode = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```mermaid/gi, '').replace(/```/g, '').trim();
    if (!cleanCode.toLowerCase().startsWith('graph')) cleanCode = 'graph TD\n' + cleanCode;
    cleanCode = cleanCode.replace(/[()]/g, "").replace(/[:;]/g, " -").replace(/[*]/g, ""); 
    openMermaidModal(cleanCode);
  } catch (error) { alert("Force Disturbance: " + error.message); } 
  finally { btnElement.textContent = "Time for a lesson, young one."; btnElement.disabled = false; }
}

async function requestYodaHint() {
  if (!gameState.currentQuestionText) return; DOM.hintBtn.textContent = "Channeling the Force..."; DOM.hintBtn.disabled = true;
  try {
    const promptText = `You are Master Yoda. The user is stuck on this question: '${gameState.currentQuestionText}'. Cryptic hint (1-2 sentences), classic pattern. No exact answer.`;
    const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
    const data = await response.json(); openYodaModal(data.candidates[0].content.parts[0].text);
  } catch (error) { openYodaModal("Force Disturbance: " + error.message); } 
  finally { DOM.hintBtn.textContent = "Need help, young one? (Ask Master Yoda)"; DOM.hintBtn.disabled = false; }
}

async function prefetchQuestions(levelKey) {
  let theme = "Original Trilogy"; if (levelKey === "level2") theme = "Prequels"; if (levelKey === "level3") theme = "Lore";
  const existingTexts = (gameState.allQuestions[levelKey] || []).map(q => q.text).slice(-15).join(" | ");
  try {
    const prompt = `Generate 5 NEW Star Wars questions about ${theme}. Do NOT repeat: ${existingTexts}. Return raw JSON array. Schema: [{"id": "dyn", "text": "...", "answers": [{"id": "a", "text": "...", "correct": true}, {"id": "b", "text": "...", "correct": false}, {"id": "c", "text": "...", "correct": false}, {"id": "d", "text": "...", "correct": false}]}]`;
    const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
    const data = await response.json();
    let newQuestions = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim());
    if (!Array.isArray(newQuestions)) newQuestions = newQuestions.questions || [newQuestions];
    newQuestions.forEach(q => q.id = 'dyn_pre_' + Date.now() + Math.random());
    if (!gameState.allQuestions[levelKey]) gameState.allQuestions[levelKey] = [];
    gameState.allQuestions[levelKey].push(...newQuestions);
  } catch (err) { console.error("Silent prefetch failed:", err); }
}

async function generateMoreQuestions(levelKey) {
  DOM.answersGrid.innerHTML = ''; DOM.questionText.textContent = "Consulting the Jedi Archives... (Generating 5 Questions)";
  const wrapper = document.getElementById('yoda-hint-wrapper'); if (wrapper) wrapper.classList.add('hidden');
  let theme = "Original Trilogy"; if (levelKey === "level2") theme = "Prequels"; if (levelKey === "level3") theme = "Lore";
  const existingTexts = (gameState.allQuestions[levelKey] || []).map(q => q.text).slice(-15).join(" | ");
  try {
    const prompt = `Generate 5 NEW Star Wars questions about ${theme}. Do NOT repeat: ${existingTexts}. Return raw JSON array. Schema: [{"id": "dyn", "text": "...", "answers": [{"id": "a", "text": "...", "correct": true}, {"id": "b", "text": "...", "correct": false}, {"id": "c", "text": "...", "correct": false}, {"id": "d", "text": "...", "correct": false}]}]`;
    const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
    const data = await response.json();
    let newQuestions = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim());
    if (!Array.isArray(newQuestions)) newQuestions = newQuestions.questions || [newQuestions];
    newQuestions.forEach(q => q.id = 'dyn_' + Date.now() + Math.random());
    if (!gameState.allQuestions[levelKey]) gameState.allQuestions[levelKey] = [];
    gameState.allQuestions[levelKey].push(...newQuestions);
    loadNextQuestion();
  } catch (err) { 
    DOM.questionText.textContent = "⚠️ Archives incomplete. Disturbance in the Force detected.";
    const retry = document.createElement('button'); retry.className = 'btn btn--primary'; retry.textContent = "🔄 Re-connect to Archives";
    retry.onclick = () => generateMoreQuestions(levelKey); DOM.answersGrid.appendChild(retry);
  }
}
/* ───────────────────────────────────────
   FSM & DYNAMIC TRANSITION LOGIC
─────────────────────────────────────── */
async function triggerTransition(isVictory) {
  showView(DOM.transitionScreen);
  DOM.transitionMsg.textContent = isVictory ? "Rank Complete!" : "You have stumbled...";
  DOM.transitionScreen.querySelectorAll('.dynamic-btn, .holo-wrapper, .ai-lore, .lore-box').forEach(b => b.remove());
  DOM.transitionXP.style.display = 'none'; 
  
  const loading = document.createElement('p');
  loading.className = 'dynamic-btn';
  loading.style.color = 'var(--star-dim)';
  loading.textContent = "Consulting the Jedi Archives for guidance...";
  DOM.transitionScreen.appendChild(loading);
  
  let theme = "Original Trilogy";
  if (gameState.currentLevel === 2) theme = "Prequels";
  if (gameState.currentLevel === 3) theme = "Deep Lore";
  
  try {
    const prompt = `The user just ${isVictory ? 'passed' : 'failed'} a Star Wars trivia rank about ${theme}. Generate JSON with two keys: "lore" (a 1-paragraph educational Star Wars fact about this theme to help them learn) and "videoSearch" (A YouTube search query to find a short, punchy educational video under 3 minutes about this lore. You MUST include keywords like 'Shorts' or 'Explained quickly' in the query, e.g., "Star Wars Shorts Kyber Crystals explained").`;
    
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    
    const data = await response.json();
    const aiData = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim());
    loading.remove();
    
    // The Datapad Lore Box
    const loreBox = document.createElement('div');
    loreBox.className = 'dynamic-btn lore-box';
    loreBox.textContent = aiData.lore;
    DOM.transitionScreen.appendChild(loreBox);
    
    // Smart YouTube Search Button
    const ytBtn = document.createElement('a');
    ytBtn.className = 'btn btn--secondary dynamic-btn';
    ytBtn.style.textDecoration = 'none';
    ytBtn.style.display = 'inline-block';
    ytBtn.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(aiData.videoSearch);
    ytBtn.target = "_blank";
    ytBtn.textContent = "📺 Search Holocron Archives";
    DOM.transitionScreen.appendChild(ytBtn);
    
    // AI Diagram Generator
    const wrapper = document.createElement('div'); 
    wrapper.className = 'holo-wrapper dynamic-btn';
    wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center'; wrapper.style.gap = '10px'; wrapper.style.marginTop = '1rem';
    
    const yodaImg = document.createElement('img'); 
    yodaImg.src = "https://upload.wikimedia.org/wikipedia/en/9/9b/Yoda_Empire_Strikes_Back.png";
    yodaImg.style.filter = "sepia(1) hue-rotate(90deg) saturate(300%) opacity(0.8) drop-shadow(0 0 10px #8bc34a)"; 
    yodaImg.style.width = "60px"; yodaImg.style.borderRadius = "50%"; yodaImg.style.pointerEvents = "none";
    
    const btn = document.createElement('button'); 
    btn.className = 'btn'; btn.textContent = "Time for a lesson, young one.";
    btn.style.borderRadius = "15px"; btn.style.backgroundColor = "rgba(139, 195, 74, 0.2)"; btn.style.border = "1px solid #8bc34a"; btn.style.color = "#8bc34a";
    btn.addEventListener('click', () => generateDynamicDiagram(aiData.lore, btn));
    
    wrapper.appendChild(yodaImg); wrapper.appendChild(btn); DOM.transitionScreen.appendChild(wrapper);
  } catch (e) {
    loading.textContent = "⚠️ Comm link to Archives disrupted.";
  }
  
  // Fully Styled Proceed Button
  DOM.transitionXP.style.display = 'block';
  DOM.transitionXP.className = 'btn btn--primary dynamic-btn';
  DOM.transitionXP.style.marginTop = '1.5rem';
  
  if (isVictory) {
    DOM.transitionXP.textContent = "Proceed to Next Rank";
    DOM.transitionXP.onclick = handleNextRank;
  } else {
    DOM.transitionXP.textContent = "Retry Rank";
    DOM.transitionXP.onclick = retryRank;
  }
}

function triggerVictory() {
  const h2 = DOM.endScreen.querySelector('h2');
  if (h2) { h2.textContent = "Jedi Trials Mastered"; h2.style.color = "var(--gold)"; h2.classList.add('victory-text'); }
  DOM.finalScore.textContent = "Calculating destiny..."; DOM.restartBtn.classList.add('hidden'); showView(DOM.endScreen);
  let rank = "Youngling"; if (gameState.score >= 800) rank = "Jedi Master"; else if (gameState.score >= 400) rank = "Jedi Knight"; else if (gameState.score >= 200) rank = "Padawan";
  setTimeout(() => { DOM.finalScore.textContent = `Final Score: ${gameState.score} | Rank: ${rank}`; }, 1500);
  setTimeout(() => { DOM.restartBtn.textContent = "♾️ Continue Endless Mode"; DOM.restartBtn.onclick = continueEndlessMode; DOM.restartBtn.classList.remove('hidden'); }, 3000);
}

function handleNextRank() { if (gameState.currentLevel === 3) { triggerVictory(); return; } gameState.currentLevel++; gameState.levelAnswered = 0; gameState.levelCorrect = 0; updateHUD(); showView(DOM.quizScreen); loadNextQuestion(); }
function retryRank() { gameState.levelAnswered = 0; gameState.levelCorrect = 0; updateHUD(); showView(DOM.quizScreen); loadNextQuestion(); }
function continueEndlessMode() { gameState.levelAnswered = 0; gameState.levelCorrect = 0; updateHUD(); showView(DOM.quizScreen); loadNextQuestion(); }

function loadNextQuestion() {
  DOM.answersGrid.innerHTML = '';
  const levelKey = `level${gameState.currentLevel}`;
  if (!gameState.allQuestions[levelKey]) gameState.allQuestions[levelKey] = [];
  const questions = gameState.allQuestions[levelKey];
  const next = questions.find(q => !gameState.usedQuestions.includes(q.id));
  if (!next) { generateMoreQuestions(levelKey); return; }
  gameState.usedQuestions.push(next.id); renderQuestion(next);
}

function renderQuestion(questionObj) {
  gameState.currentQuestionObj = questionObj; gameState.currentQuestionText = questionObj.text; DOM.questionText.textContent = questionObj.text;
  questionObj.answers.forEach(answer => {
    const btn = document.createElement('button'); btn.className = 'btn btn--answer'; btn.textContent = answer.text; btn.dataset.correct = answer.correct;
    btn.addEventListener('click', () => handleAnswer(answer.correct, btn)); DOM.answersGrid.appendChild(btn);
  });
  
  let wrapper = document.getElementById('yoda-hint-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div'); wrapper.id = 'yoda-hint-wrapper';
    wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center'; wrapper.style.justifyContent = 'center'; wrapper.style.gap = '15px'; wrapper.style.marginTop = '20px';
    const img = document.createElement('img'); img.src = "https://upload.wikimedia.org/wikipedia/en/9/9b/Yoda_Empire_Strikes_Back.png";
    img.style.width = "60px"; img.style.borderRadius = "50%"; img.style.filter = "sepia(1) hue-rotate(180deg) saturate(300%) opacity(0.7) drop-shadow(0 0 10px #00ffff)";
    DOM.hintBtn.parentNode.insertBefore(wrapper, DOM.hintBtn); wrapper.appendChild(img); wrapper.appendChild(DOM.hintBtn); DOM.hintBtn.style.borderRadius = "15px";
  }
  DOM.hintBtn.textContent = "Need help, young one? (Ask Master Yoda)"; DOM.hintBtn.classList.remove('hidden'); wrapper.classList.remove('hidden');
}

function handleAnswer(isCorrect, selectedBtn) {
  playSensoryFeedback(isCorrect);
  DOM.answersGrid.querySelectorAll('.btn--answer').forEach(b => b.disabled = true);
  selectedBtn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) DOM.answersGrid.querySelectorAll('.btn--answer').forEach(b => { if (b.dataset.correct === 'true') b.classList.add('correct'); });

  setTimeout(() => {
    gameState.levelAnswered++;
    if (isCorrect) { gameState.levelCorrect++; gameState.score += (gameState.currentQuestionObj.points || 100); }
    updateHUD();

    const remaining = 5 - gameState.levelAnswered;
    const wrongCount = gameState.levelAnswered - gameState.levelCorrect;

    if (gameState.levelCorrect === 3 && remaining > 0 && gameState.currentLevel < 3) prefetchQuestions(`level${gameState.currentLevel + 1}`);
    if (wrongCount === 3 && remaining > 0) prefetchQuestions(`level${gameState.currentLevel}`);

    if (gameState.levelCorrect >= 3 && gameState.levelAnswered === 5) { triggerTransition(true); } 
    else if (gameState.levelCorrect + remaining < 3) { triggerTransition(false); } 
    else { loadNextQuestion(); }
  }, 1000);
}

async function init() { 
  await loadData(); 
  DOM.beginBtn.addEventListener('click', () => { initAudioContext(); handleBeginTrials(); }); 
  DOM.modalCloseBtn.addEventListener('click', closeMediaModal); 
  DOM.hintBtn.addEventListener('click', requestYodaHint); 
  showView(DOM.startScreen); 
}

function handleBeginTrials() { 
  gameState.score = 0; gameState.levelAnswered = 0; gameState.levelCorrect = 0; gameState.currentLevel = 1; gameState.usedQuestions = []; 
  updateHUD(); showView(DOM.quizScreen); loadNextQuestion(); 
}

init();

