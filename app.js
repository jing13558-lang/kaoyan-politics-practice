const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey = 'politics-years-practice-v2';
let papers = [];
let year = 2026;
let current = 1;
let selection = [];
let state = {year:2026,papers:{}};

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') state = {year:saved.year || 2026,papers:saved.papers || {}};
  else {
    const previous = JSON.parse(localStorage.getItem('politics-2026-practice-v1'));
    if (previous) state.papers['2026'] = {attempts:previous.attempts || {},essays:previous.essays || {}};
  }
} catch {}

function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
function activePaper(){return papers.find(p=>p.year===year);}
function paperState(){return state.papers[String(year)] ||= {attempts:{},essays:{}};}
function questionNumbers(){const p=activePaper();return [...p.questions.map(q=>q.number),...p.essays.map(q=>q.number)];}
function answerKey(values){return [...values].sort().join('');}
function defaultQuestion(){const p=activePaper(), attempts=paperState().attempts;return p.questions.find(q=>!attempts[q.number])?.number || p.questions[0].number;}
function navigate(number){if(!questionNumbers().includes(number))return;current=number;selection=[];render();$('practice').scrollIntoView({behavior:'smooth',block:'start'});}
function goNext(){const numbers=questionNumbers();navigate(numbers[numbers.indexOf(current)+1]);}
function changeYear(next){if(next===year)return;year=next;state.year=next;current=defaultQuestion();selection=[];save();render();$('practice').scrollIntoView({behavior:'smooth',block:'start'});}

function renderYears(){
  $('year-options').innerHTML=[...papers].reverse().map(p=>`<button type="button" data-year="${p.year}" class="${p.year===year?'active':''}" ${p.year===year?'aria-current="true"':''}>${p.year}</button>`).join('');
  document.querySelectorAll('[data-year]').forEach(button=>button.addEventListener('click',()=>changeYear(Number(button.dataset.year))));
}
function renderStats(){
  const p=activePaper(),attempts=paperState().attempts,done=p.questions.filter(q=>attempts[q.number]),correct=done.filter(q=>attempts[q.number].correct).length;
  const points=q=>q.type==='单选'?1:2;
  const score=done.reduce((sum,q)=>sum+(attempts[q.number].correct?points(q):0),0);
  const availableScore=p.questions.reduce((sum,q)=>sum+points(q),0);
  const maxScore=50;
  const missingPoints=maxScore-availableScore;
  const accuracy=done.length?Math.round(correct/done.length*100):0;
  const complete=done.length===p.questions.length;
  $('sidebar-year').textContent=year;
  $('toolbar-year').textContent=year;
  $('progress-fraction').textContent=`${done.length} / ${p.questions.length}`;
  $('progress-bar').style.width=`${done.length/p.questions.length*100}%`;
  $('correct-count').textContent=correct;
  $('wrong-count').textContent=done.length-correct;
  $('left-count').textContent=p.questions.length-done.length;
  $('accuracy-rate').textContent=`${accuracy}%`;
  $('score-label').textContent=missingPoints?'已核算客观题':'客观题得分';
  $('live-score').textContent=score;
  $('max-score').textContent=maxScore;
  $('score-rule').textContent=`正式试卷满分 100 分：单选 16 分、多选 34 分、分析题 50 分。多选须全部选对；分析题需人工评阅。${missingPoints?`原 PDF 缺题 ${missingPoints} 分，暂无法核算。`:''}`;
  $('score-summary').hidden=!complete;
  $('summary-heading').textContent=missingPoints?'已收录客观题已完成':'本年客观题已完成';
  $('final-score').textContent=missingPoints?`已核算 ${score} 分`:`${score} / ${maxScore} 分`;
  $('final-detail').textContent=missingPoints?`缺失 ${missingPoints} 分未核算，客观题实际得分为 ${score}—${score+missingPoints} 分（满分 50 分）`:`答对 ${correct} / ${p.questions.length} 题 · 正确率 ${accuracy}% · 分析题另有 50 分需人工评阅`;
  $('missing-note').hidden=p.missing.length===0;
  $('missing-note').textContent=p.missing.length?`原 PDF 未收录第 ${p.missing.join('、')} 题，已按原文件保留题号。`:'';
}
function renderNav(){
  const p=activePaper(),attempts=paperState().attempts;
  for (const [id,type,countId] of [['single-nav','单选','single-count'],['multi-nav','多选','multi-count']]){
    const questions=p.questions.filter(q=>q.type===type);
    $(countId).textContent=`${questions.length} 题`;
    $(id).innerHTML=questions.map(q=>{
      const n=q.number,a=attempts[n],cls=[n===current?'active':'',a?a.correct?'correct':'wrong':''].join(' ');
      return `<button type="button" class="${cls}" data-go="${n}" aria-label="${year} 年第 ${n} 题${a?a.correct?'，已答对':'，待巩固':'，未作答'}" ${n===current?'aria-current="true"':''}>${String(n).padStart(2,'0')}</button>`;
    }).join('');
  }
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(Number(b.dataset.go))));
}
function renderObjective(){
  const p=activePaper(),q=p.questions.find(item=>item.number===current),attempt=paperState().attempts[current],chosen=attempt?attempt.choice.split(''):selection;
  $('section-name').textContent=q.type==='单选'?'单选题':'多选题';
  const options=Object.entries(q.options).map(([letter,copy])=>{
    const selected=chosen.includes(letter),right=attempt&&q.answer.includes(letter),wrong=attempt&&selected&&!right;
    return `<button type="button" class="${['option',selected?'selected':'',right?'answer-right':'',wrong?'answer-wrong':''].join(' ')}" data-option="${letter}" aria-pressed="${selected}" ${attempt?'disabled':''}><span class="option-letter">${letter}</span><span class="option-copy">${escapeHTML(copy)}</span></button>`;
  }).join('');
  const result=attempt?`<div class="result ${attempt.correct?'correct':'wrong'}" role="status"><div class="result-title">${attempt.correct?'答对了，继续保持！':'这题还需巩固一下'}</div><div class="answer-text">你的答案：${escapeHTML(attempt.choice)}　·　正确答案：${q.answer}</div><button type="button" class="submit result-next" id="inline-next-button">下一题 →</button><div class="explanation"><strong>答案解析</strong><br>${escapeHTML(q.explanation)}</div></div>`:'';
  const position=p.questions.findIndex(item=>item.number===current)+1;
  $('question-card').innerHTML=`<div class="question-meta"><span class="question-tag ${q.type==='多选'?'multi':''}">${q.type}</span><span class="year-pill">${year} 年</span><span>${escapeHTML(q.subject)}</span><span>·</span><span>${escapeHTML(q.topic)}</span><span class="question-count">${String(position).padStart(2,'0')} / ${p.questions.length}</span></div><h2>第 ${q.number} 题</h2><p class="question-stem">${escapeHTML(q.stem)}</p><p class="selection-hint">${q.type==='多选'?'选择所有你认为正确的选项，再提交答案。':'点选一个选项，立即查看结果。'}</p><div class="options">${options}</div><div class="action-row">${attempt?'<button type="button" class="retry" id="retry-question">再做一次</button>':q.type==='多选'?`<button type="button" class="submit" id="submit-answer" ${selection.length?'':'disabled'}>提交答案</button>`:''}</div>${result}`;
  document.querySelectorAll('[data-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.option)));
  $('submit-answer')?.addEventListener('click',submitAnswer);
  $('retry-question')?.addEventListener('click',()=>{delete paperState().attempts[current];selection=[];save();render();});
  $('inline-next-button')?.addEventListener('click',goNext);
}
function choose(letter){
  const q=activePaper().questions.find(item=>item.number===current);
  if(paperState().attempts[current])return;
  if(q.type==='单选'){selection=[letter];submitAnswer();return;}
  selection=selection.includes(letter)?selection.filter(x=>x!==letter):[...selection,letter];renderObjective();
}
function submitAnswer(){
  if(!selection.length)return;
  const q=activePaper().questions.find(item=>item.number===current),choice=answerKey(selection);
  paperState().attempts[current]={choice,correct:choice===answerKey(q.answer.split(''))};
  selection=[];save();render();
}
function renderEssay(){
  const q=activePaper().essays.find(item=>item.number===current);
  $('section-name').textContent='分析题';
  const content=q.content.replace(/\s*(\(\d+\))/g,'\n$1').trim();
  $('question-card').innerHTML=`<div class="question-meta"><span class="question-tag multi">分析题</span><span class="year-pill">${year} 年</span><span>${escapeHTML(q.subject)}</span><span>·</span><span>${escapeHTML(q.topic)}</span><span class="question-count">${current} / 38</span></div><h2>第 ${current} 题</h2><div class="analysis-intro">PDF 中的分析题材料是节选或概述，未附标准答案，因此无法准确自动判定对错。这里可阅读题目并保存自己的作答。</div><div class="analysis-prompt essay-content">${escapeHTML(content)}</div><p class="selection-hint" style="margin:23px 0 9px">我的作答</p><textarea id="essay-answer" class="analysis-text" placeholder="在这里写下你的思路或答案……">${escapeHTML(paperState().essays[current]||'')}</textarea><div class="action-row"><button type="button" class="submit" id="save-essay">保存作答</button><span id="save-status" class="save-status"></span></div>`;
  $('save-essay').addEventListener('click',()=>{paperState().essays[current]=$('essay-answer').value;save();$('save-status').textContent='已保存在本机浏览器';});
}
function render(){
  if(!papers.length)return;
  renderYears();renderStats();renderNav();
  if(activePaper().questions.some(q=>q.number===current))renderObjective();else renderEssay();
  const numbers=questionNumbers(),index=numbers.indexOf(current);
  $('prev-button').disabled=index<=0;$('next-button').disabled=index>=numbers.length-1;
  $('next-button').hidden=!!paperState().attempts[current];
  $('page-indicator').textContent=`${String(index+1).padStart(2,'0')} / ${numbers.length}`;
}

$('start-button').addEventListener('click',()=>$('practice').scrollIntoView({behavior:'smooth'}));
$('analysis-link').addEventListener('click',()=>navigate(34));
$('prev-button').addEventListener('click',()=>{const ns=questionNumbers();navigate(ns[ns.indexOf(current)-1]);});
$('next-button').addEventListener('click',goNext);
$('reset-button').addEventListener('click',()=>{if(confirm(`确定清空 ${year} 年试卷的答题进度和分析题作答吗？`)){state.papers[String(year)]={attempts:{},essays:{}};selection=[];save();render();}});

fetch('papers.json').then(response=>{if(!response.ok)throw Error('试卷文件加载失败');return response.json()}).then(data=>{
  if(!Array.isArray(data)||data.length!==12)throw Error('试卷数量不完整');
  papers=data;year=papers.some(p=>p.year===state.year)?state.year:2026;current=defaultQuestion();render();
}).catch(error=>{$('question-card').innerHTML=`<div class="error-message">试卷暂时无法加载，请刷新页面重试。<br>${escapeHTML(error.message)}</div>`;});
