/* 잿불 용병단 개발 기록 — 빌드 도구 없는 정적 사이트.
   내용은 data 폴더의 JSON 과 content 폴더의 Markdown 만 고치면 된다. */
(() => {
  'use strict';

  const KEY_PREFIX = 'EMBER';
  const STATUSES = ['할 일', '진행 중', '검토', '완료', '중단'];
  const STATUS_COLOR = { '할 일': 'gray', '진행 중': 'blue', '검토': 'purple', '완료': 'green', '중단': 'red' };
  const TYPE_INFO = {
    '에픽': { cls: 'epic', ch: '⚡' },
    '스토리': { cls: 'story', ch: 'S' },
    '작업': { cls: 'task', ch: '✓' },
    '버그': { cls: 'bug', ch: '●' },
  };
  const PRIO_INFO = {
    '최상': { cls: 'p0', ch: '⇈' },
    '높음': { cls: 'p1', ch: '↑' },
    '보통': { cls: 'p2', ch: '=' },
    '낮음': { cls: 'p3', ch: '↓' },
  };
  const PART_COLOR = {
    '기획': 'purple', '콘텐츠': 'brown', 'UI': 'blue', '아트': 'pink', '전투': 'red',
    '데이터': 'orange', 'QA': 'yellow', '사운드': 'green', '도구': 'gray', '빌드': 'gray',
  };
  const LOG_TAG_COLOR = { '구현': 'blue', '기획': 'purple', '검증': 'green', '조사': 'yellow', '전환': 'orange', '도구': 'gray' };
  const MILESTONES = [
    '초기 탐색', '게임회사 경영', '용병단 모바일', '룬 릴 M0', '룬 릴 M1', '개발 환경',
    'S0 긁기 손맛', 'S1 전투 시뮬레이션', 'S2 전투 한 판', 'S3 런 하나', 'S4 거점과 메타', 'S5 Steam 데모',
  ];

  const state = {
    site: null, tasks: [], byKey: new Map(), logs: [], mdCache: new Map(),
    filter: { milestone: '', epic: '', part: '', type: '', q: '' },
    collapsed: null, lastPath: null,
  };

  const app = document.getElementById('app');
  const crumbs = document.getElementById('crumbs');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  // ---------- 공용 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyText = (k) => `${KEY_PREFIX}-${k}`;
  const tag = (text, color) => `<span class="tag ${color || 'gray'}">${esc(text)}</span>`;
  const statusTag = (s) => `<span class="status tag ${STATUS_COLOR[s] || 'gray'}">${esc(s)}</span>`;
  const typeIcon = (t) => { const i = TYPE_INFO[t] || TYPE_INFO['작업']; return `<span class="ticon ${i.cls}" title="${esc(t)}">${i.ch}</span>`; };
  const prioIcon = (p) => { const i = PRIO_INFO[p] || PRIO_INFO['보통']; return `<span class="prio ${i.cls}" title="우선순위 ${esc(p)}">${i.ch}</span>`; };
  const partTags = (parts) => `<span class="tags">${(parts || []).map((p) => tag(p, PART_COLOR[p])).join('')}</span>`;
  const fmtDate = (d) => (d ? d.replaceAll('-', '.') : '');
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isEpic = (t) => t.type === '에픽';
  const children = (epicKey) => state.tasks.filter((t) => t.epic === epicKey);
  const taskHref = (k) => `#${currentPath()}?t=${k}`;

  function progress(list) {
    const total = list.length;
    const done = list.filter((t) => t.status === '완료').length;
    const doing = list.filter((t) => t.status === '진행 중' || t.status === '검토').length;
    const stop = list.filter((t) => t.status === '중단').length;
    return { total, done, doing, stop };
  }
  function progressBar(p) {
    if (!p.total) return '<div class="bar"></div>';
    const w = (n) => `${(n / p.total) * 100}%`;
    return `<div class="bar" title="완료 ${p.done} · 진행 ${p.doing} · 중단 ${p.stop} / 전체 ${p.total}"><i class="b-done" style="width:${w(p.done)}"></i><i class="b-doing" style="width:${w(p.doing)}"></i><i class="b-stop" style="width:${w(p.stop)}"></i></div>`;
  }

  // ---------- 아주 작은 Markdown 변환기 ----------
  function inline(s) {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const safe = /^(https?:|#|\.?\/|[\w-]+\.)/.test(url) ? url : '#';
      const ext = /^https?:/.test(safe) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${safe}"${ext}>${text}</a>`;
    });
    return out;
  }
  function markdown(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let i = 0;
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (line.startsWith('```')) {
        const buf = []; i++;
        while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
        i++;
        html.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
        continue;
      }
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { const lv = Math.max(2, h[1].length); html.push(`<h${lv}>${inline(h[2])}</h${lv}>`); i++; continue; }
      if (line.startsWith('>')) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
        html.push(`<blockquote><div>${inline(buf.join(' '))}</div></blockquote>`);
        continue;
      }
      if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = cells(line); i += 2;
        const body = [];
        while (i < lines.length && isTableRow(lines[i])) body.push(cells(lines[i++]));
        html.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
        html.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
        html.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`);
        continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !isTableRow(lines[i])) buf.push(lines[i++]);
      html.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return html.join('\n');
  }
  async function loadMd(path) {
    if (state.mdCache.has(path)) return state.mdCache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} 를 불러오지 못했습니다 (${res.status})`);
    const text = await res.text();
    state.mdCache.set(path, text);
    return text;
  }

  // ---------- 행 · 카드 ----------
  function taskRow(t, opts = {}) {
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    return `<a class="row" href="${taskHref(t.key)}">
      ${typeIcon(t.type)}<span class="key">${keyText(t.key)}</span>
      <span class="rt">${esc(t.title)}</span>
      <span class="rm">${opts.showEpic && epic ? tag(epic.title, 'purple') : ''}${partTags(t.parts)}${prioIcon(t.priority)}${statusTag(t.status).replace('class="status tag', 'class="status tag keep')}</span>
    </a>`;
  }
  function taskCard(t) {
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    return `<a class="card" href="${taskHref(t.key)}">
      <div class="ct">${esc(t.title)}</div>
      ${epic ? `<div class="cepic">${tag(epic.title, 'purple')}</div>` : ''}
      <div class="cf">${typeIcon(t.type)}${prioIcon(t.priority)}${partTags(t.parts.slice(0, 2))}<span class="key">${keyText(t.key)}</span></div>
    </a>`;
  }
  function logRow(l) {
    return `<a class="log-item" href="#/devlog/${encodeURIComponent(l.slug)}">
      <div class="log-date">${fmtDate(l.date)}</div>
      <div><div class="log-title">${esc(l.title)}</div><div class="log-sum">${esc(l.summary)}</div>
      <span class="tags">${l.tags.map((g) => tag(g, LOG_TAG_COLOR[g])).join('')}</span></div>
    </a>`;
  }

  // ---------- 페이지: 홈 ----------
  function renderHome() {
    const s = state.site;
    const items = state.tasks.filter((t) => !isEpic(t));
    const p = progress(items);
    const doing = items.filter((t) => t.status === '진행 중' || t.status === '검토');
    const next = items.filter((t) => t.status === '할 일').slice(0, 5);
    setCrumbs([['홈']]);
    app.className = 'page';
    app.innerHTML = `
      <div class="page-icon">🔥</div>
      <h1 class="page-title">${esc(s.title)}</h1>
      <p class="page-sub">${esc(s.intro)}</p>
      <div class="callout"><span class="ci">💡</span><div>${esc(s.notice)}</div></div>
      <div class="stats">
        <div class="stat"><b>${p.total}</b><span>전체 작업 (에픽 제외)</span></div>
        <div class="stat"><b>${p.done}</b><span>완료</span></div>
        <div class="stat"><b>${p.doing}</b><span>진행 중 · 검토</span></div>
        <div class="stat"><b>${state.logs.length}</b><span>개발 일지</span></div>
      </div>
      <div class="doc">
        <h2>한눈에</h2>
        <div class="table-wrap"><table class="ntable"><tbody>${s.facts.map(([k, v]) => `<tr><th style="width:120px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="db-head"><h2>⏳ 지금 진행 중</h2><a class="more" href="#/tracker/board">보드에서 보기 →</a></div>
      <div class="rows">${doing.map((t) => taskRow(t, { showEpic: true })).join('') || '<p class="muted">진행 중인 작업이 없습니다.</p>'}</div>
      <div class="db-head"><h2>📌 다음 할 일</h2><a class="more" href="#/tracker/backlog">백로그 전체 →</a></div>
      <div class="rows">${next.map((t) => taskRow(t, { showEpic: true })).join('')}</div>
      <div class="db-head"><h2>📓 최근 개발 일지</h2><a class="more" href="#/devlog">전체 보기 →</a></div>
      <div class="log-list">${state.logs.slice(0, 3).map(logRow).join('')}</div>
      <div class="doc">
        <h2>걸어온 길</h2>
        <ul class="timeline">${s.history.map((h, idx) => `<li class="${idx === s.history.length - 1 ? 'now' : ''}"><div class="tl-period">${esc(h.period)}</div><div class="tl-title">${esc(h.title)}</div><div class="tl-text">${esc(h.text)}</div></li>`).join('')}</ul>
        <h2>이전 버전 화면 (모바일)</h2>
        <p class="muted">Unity 에디터 Game View 390×844에서 캡처했습니다. 실제 기기 빌드는 하지 않았습니다.</p>
        <div class="shots">${s.screenshots.map((im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy"><figcaption>${esc(im.alt)}</figcaption></figure>`).join('')}</div>
        <h2>작업 원칙</h2>
        <ul>${s.principles.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <hr class="div">
        <p class="muted">만든 사람: ${esc(s.owner)} · ${esc(s.role)} · <a href="${esc(s.github)}" target="_blank" rel="noopener">GitHub</a></p>
      </div>`;
  }

  // ---------- 페이지: 기획 ----------
  async function renderDesign() {
    setCrumbs([['기획']]);
    app.className = 'page';
    app.innerHTML = '<p class="muted">불러오는 중…</p>';
    const md = await loadMd('content/design.md');
    app.innerHTML = `<div class="page-icon">📐</div><h1 class="page-title">기획: 긁는 복권 로그라이크</h1>
      <p class="page-sub">2026-11-13 초안 기준 · PC Steam</p><div class="doc">${markdown(md)}</div>`;
  }

  // ---------- 페이지: 트래커 ----------
  function filtered() {
    const f = state.filter;
    const q = f.q.trim().toLowerCase();
    return state.tasks.filter((t) => !isEpic(t)
      && (!f.milestone || t.milestone === f.milestone)
      && (!f.epic || String(t.epic) === f.epic)
      && (!f.part || t.parts.includes(f.part))
      && (!f.type || t.type === f.type)
      && (!q || t.title.toLowerCase().includes(q) || keyText(t.key).toLowerCase().includes(q) || (t.memo || '').toLowerCase().includes(q)));
  }
  function filterBar(count) {
    const f = state.filter;
    const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    const parts = [...new Set(state.tasks.flatMap((t) => t.parts))].sort((a, b) => a.localeCompare(b, 'ko'));
    const epics = state.tasks.filter(isEpic);
    return `<div class="filters">
      <input type="search" data-f="q" placeholder="제목 · 키 검색" value="${esc(f.q)}" aria-label="작업 검색">
      <select data-f="milestone" aria-label="마일스톤">${opt('', '마일스톤: 전체', f.milestone)}${MILESTONES.map((m) => opt(m, m, f.milestone)).join('')}</select>
      <select data-f="epic" aria-label="에픽">${opt('', '에픽: 전체', f.epic)}${epics.map((e) => opt(String(e.key), e.title, f.epic)).join('')}</select>
      <select data-f="part" aria-label="파트">${opt('', '파트: 전체', f.part)}${parts.map((p) => opt(p, p, f.part)).join('')}</select>
      <select data-f="type" aria-label="유형">${opt('', '유형: 전체', f.type)}${['스토리', '작업', '버그'].map((p) => opt(p, p, f.type)).join('')}</select>
      <button class="reset" type="button" data-reset>초기화</button>
      <span class="count">${count}건</span>
    </div>`;
  }
  function bindFilters(rerender) {
    app.querySelectorAll('[data-f]').forEach((elm) => {
      const ev = elm.tagName === 'INPUT' ? 'input' : 'change';
      elm.addEventListener(ev, () => {
        state.filter[elm.dataset.f] = elm.value;
        const pos = elm.tagName === 'INPUT' ? elm.selectionStart : null;
        rerender();
        if (pos !== null) { const again = app.querySelector('[data-f="q"]'); again.focus(); again.setSelectionRange(pos, pos); }
      });
    });
    const r = app.querySelector('[data-reset]');
    if (r) r.addEventListener('click', () => { state.filter = { milestone: '', epic: '', part: '', type: '', q: '' }; rerender(); });
  }
  function trackerTabs(view) {
    const tabs = [['board', '▦ 보드'], ['backlog', '☰ 백로그'], ['roadmap', '▬ 로드맵'], ['epics', '⚡ 에픽']];
    return `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/tracker/${k}" class="${k === view ? 'active' : ''}">${l}</a>`).join('')}</div>`;
  }
  function trackerHeader(view) {
    return `<h1 class="page-title" style="font-size:30px;margin-top:8px">작업 트래커</h1>
      <p class="page-sub">키 형식 ${KEY_PREFIX}-번호 · 에픽 ${state.tasks.filter(isEpic).length}개 · 작업 ${state.tasks.filter((t) => !isEpic(t)).length}개</p>${trackerTabs(view)}`;
  }

  function renderBoard() {
    const list = filtered();
    const cols = STATUSES.map((s) => {
      const items = list.filter((t) => t.status === s);
      return `<section class="col" aria-label="${esc(s)}"><div class="col-head">${statusTag(s)}<span class="n">${items.length}</span></div>
        ${items.map(taskCard).join('') || '<div class="col-empty">비어 있음</div>'}</section>`;
    }).join('');
    app.innerHTML = `${trackerHeader('board')}${filterBar(list.length)}<div class="board">${cols}</div>`;
    bindFilters(renderBoard);
  }

  function renderBacklog() {
    const list = filtered();
    if (!state.collapsed) {
      state.collapsed = new Set(MILESTONES.filter((m) => {
        const items = state.tasks.filter((t) => !isEpic(t) && t.milestone === m);
        return items.length && items.every((t) => t.status === '완료' || t.status === '중단');
      }));
    }
    const groups = MILESTONES.map((m) => {
      const items = list.filter((t) => t.milestone === m);
      if (!items.length) return '';
      const all = state.tasks.filter((t) => !isEpic(t) && t.milestone === m);
      const p = progress(all);
      const dates = all.flatMap((t) => [t.start, t.end]).filter(Boolean).sort();
      const range = dates.length ? `${fmtDate(dates[0])} ~ ${fmtDate(dates[dates.length - 1])}` : '일정 미정';
      return `<section class="sprint ${state.collapsed.has(m) ? 'collapsed' : ''}" data-m="${esc(m)}">
        <div class="sprint-head" role="button" tabindex="0" aria-expanded="${!state.collapsed.has(m)}"><span class="caret">▼</span><b>${esc(m)}</b>
          <span class="sp-meta">${range} · ${items.length}건 · 완료 ${p.done}/${p.total}</span>${progressBar(p)}</div>
        <div class="rows">${items.map((t) => taskRow(t, { showEpic: false })).join('')}</div>
      </section>`;
    }).join('');
    app.innerHTML = `${trackerHeader('backlog')}${filterBar(list.length)}${groups || '<p class="muted">조건에 맞는 작업이 없습니다.</p>'}`;
    bindFilters(renderBacklog);
    app.querySelectorAll('.sprint-head').forEach((h) => {
      const toggle = () => {
        const m = h.parentElement.dataset.m;
        if (state.collapsed.has(m)) state.collapsed.delete(m); else state.collapsed.add(m);
        h.parentElement.classList.toggle('collapsed');
        h.setAttribute('aria-expanded', String(!state.collapsed.has(m)));
      };
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

  function renderRoadmap() {
    const epics = state.tasks.filter(isEpic);
    const now = today();
    const starts = epics.map((e) => e.start).filter(Boolean).map(parseDate);
    const ends = epics.map((e) => e.end).filter(Boolean).map(parseDate);
    const minD = new Date(Math.min(...starts));
    const maxD = new Date(Math.max(...ends, now));
    const from = new Date(minD.getFullYear(), minD.getMonth(), 1);
    const to = new Date(maxD.getFullYear(), maxD.getMonth() + 2, 1);
    const months = [];
    for (let d = new Date(from); d < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
    const span = to - from;
    const pct = (d) => ((d - from) / span) * 100;
    const dayMs = 86400000;
    const rows = epics.map((e) => {
      const p = progress(children(e.key));
      let bar;
      if (!e.start) {
        bar = '<span class="muted" style="font-size:12px;padding-left:12px">일정 미정</span>';
      } else {
        const s = parseDate(e.start);
        const end = e.end ? new Date(parseDate(e.end).getTime() + dayMs) : new Date(now.getTime() + dayMs);
        const cls = e.status === '완료' ? 'done' : e.status === '중단' ? 'stop' : e.status === '할 일' ? 'todo' : 'doing';
        const label = `${p.done}/${p.total}`;
        bar = `<a class="rm-bar ${cls}" href="${taskHref(e.key)}" style="left:${pct(s)}%;width:${Math.max(pct(end) - pct(s), 0.6)}%" title="${esc(e.title)} · ${fmtDate(e.start)} ~ ${e.end ? fmtDate(e.end) : '진행 중'}">${label}</a>`;
      }
      return `<a class="rm-cell rm-name" href="${taskHref(e.key)}">${typeIcon('에픽')}<span class="t">${esc(e.title)}</span></a>
        <div class="rm-cell rm-track"><div class="rm-lines">${months.map(() => '<div></div>').join('')}</div>${bar}</div>`;
    }).join('');
    const todayLine = now >= from && now < to ? `<div class="rm-today" style="left:calc(240px + (100% - 240px) * ${pct(now) / 100})"></div>` : '';
    app.innerHTML = `${trackerHeader('roadmap')}
      <div class="roadmap"><div class="rm-grid" style="position:relative">
        <div class="rm-cell rm-name rm-head" style="cursor:default">에픽</div>
        <div class="rm-cell rm-track rm-head"><div class="rm-months">${months.map((m) => `<div>${m.getFullYear()}.${String(m.getMonth() + 1).padStart(2, '0')}</div>`).join('')}</div></div>
        ${rows}${todayLine}
      </div></div>
      <p class="rm-note">막대 안 숫자는 하위 작업 완료/전체. 초록 = 완료, 파랑 = 진행 중(오늘까지), 회색 = 중단. 시작하지 않은 에픽은 날짜를 지어내지 않고 "일정 미정"으로 둡니다.</p>`;
  }

  function renderEpics() {
    const epics = state.tasks.filter(isEpic);
    app.innerHTML = `${trackerHeader('epics')}<div class="epics">${epics.map((e) => {
      const p = progress(children(e.key));
      return `<a class="epic-card" href="${taskHref(e.key)}" style="text-decoration:none">
        <div class="et">${typeIcon('에픽')}<span>${esc(e.title)}</span></div>
        <div>${statusTag(e.status)} ${tag(e.milestone, 'gray')}</div>
        <div class="em">${esc(e.memo || '')}</div>
        <div class="ef">${progressBar(p)}<span>${p.done}/${p.total}</span><span class="key">${keyText(e.key)}</span></div>
      </a>`;
    }).join('')}</div>`;
  }

  function renderTracker(view) {
    const names = { board: '보드', backlog: '백로그', roadmap: '로드맵', epics: '에픽' };
    if (!names[view]) view = 'board';
    setCrumbs([['작업 트래커', '#/tracker/board'], [names[view]]]);
    app.className = 'page wide';
    ({ board: renderBoard, backlog: renderBacklog, roadmap: renderRoadmap, epics: renderEpics })[view]();
  }

  // ---------- 페이지: 개발 일지 ----------
  function renderDevlogList() {
    setCrumbs([['개발 일지']]);
    app.className = 'page';
    app.innerHTML = `<div class="page-icon">📓</div><h1 class="page-title">개발 일지</h1>
      <p class="page-sub">무엇을 했고, 무엇을 확인했고, 무엇을 확인하지 못했는지 적습니다. 최신순.</p>
      <div class="log-list">${state.logs.map(logRow).join('')}</div>`;
  }
  async function renderDevlog(slug) {
    const idx = state.logs.findIndex((l) => l.slug === slug);
    if (idx < 0) return renderNotFound();
    const l = state.logs[idx];
    setCrumbs([['개발 일지', '#/devlog'], [l.title]]);
    app.className = 'page';
    app.innerHTML = '<p class="muted">불러오는 중…</p>';
    const md = await loadMd(`content/devlog/${l.slug}.md`);
    const newer = state.logs[idx - 1];
    const older = state.logs[idx + 1];
    const rel = (l.tasks || []).map((k) => state.byKey.get(k)).filter(Boolean);
    app.innerHTML = `<div class="page-icon">📓</div><h1 class="page-title">${esc(l.title)}</h1>
      <dl class="props">
        <dt>📅 날짜</dt><dd>${fmtDate(l.date)}</dd>
        <dt>🏷 분류</dt><dd>${l.tags.map((g) => tag(g, LOG_TAG_COLOR[g])).join('')}</dd>
        <dt>🔗 관련 작업</dt><dd>${rel.map((t) => `<a class="link-btn" href="${taskHref(t.key)}">${typeIcon(t.type)} ${esc(t.title)}</a>`).join(' · ') || '<span class="muted">없음</span>'}</dd>
      </dl>
      <div class="callout"><span class="ci">💬</span><div>${esc(l.summary)}</div></div>
      <div class="doc">${markdown(md)}</div>
      <hr class="div">
      <div style="display:flex;justify-content:space-between;gap:12px;font-size:14px">
        <span>${older ? `<a href="#/devlog/${encodeURIComponent(older.slug)}">← ${esc(older.title)}</a>` : ''}</span>
        <span style="text-align:right">${newer ? `<a href="#/devlog/${encodeURIComponent(newer.slug)}">${esc(newer.title)} →</a>` : ''}</span>
      </div>`;
  }

  function renderNotFound() {
    setCrumbs([['찾을 수 없음']]);
    app.className = 'page';
    app.innerHTML = '<h1 class="page-title">페이지를 찾을 수 없습니다</h1><p><a href="#/">홈으로</a></p>';
  }

  // ---------- 작업 상세 (모달) ----------
  function openTask(k) {
    const t = state.byKey.get(k);
    if (!t) { closeModal(); return; }
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    const kids = isEpic(t) ? children(t.key) : [];
    const logs = state.logs.filter((l) => (l.tasks || []).includes(t.key));
    const prop = (label, val) => `<dt>${label}</dt><dd class="${val ? '' : 'empty'}">${val || '비어 있음'}</dd>`;
    const period = t.start ? `${fmtDate(t.start)} → ${t.end ? fmtDate(t.end) : (t.status === '진행 중' ? '진행 중' : '')}` : '';
    modalBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px">${typeIcon(t.type)}<span class="key">${keyText(t.key)}</span></div>
      <h1 id="modal-title">${esc(t.title)}</h1>
      <dl class="props">
        ${prop('상태', statusTag(t.status))}
        ${prop('유형', `${typeIcon(t.type)} ${esc(t.type)}`)}
        ${prop('우선순위', `${prioIcon(t.priority)} ${esc(t.priority)}`)}
        ${prop('마일스톤', tag(t.milestone, 'gray'))}
        ${prop('파트', partTags(t.parts))}
        ${isEpic(t) ? '' : prop('상위 에픽', epic ? `<a class="link-btn" href="${taskHref(epic.key)}">${typeIcon('에픽')} ${esc(epic.title)}</a>` : '')}
        ${prop('기간', esc(period))}
        ${prop('커밋', t.commit ? `<code>${esc(t.commit)}</code>` : '')}
        ${prop('근거 문서', t.doc ? esc(t.doc) : '')}
      </dl>
      ${t.memo ? `<div class="callout"><span class="ci">📝</span><div>${esc(t.memo)}</div></div>` : ''}
      ${kids.length ? `<div class="db-head"><h2>하위 작업</h2><span class="more" style="cursor:default">${progress(kids).done}/${kids.length} 완료</span></div>
        <div style="margin:6px 0 10px">${progressBar(progress(kids))}</div>
        <div class="rows">${kids.map((c) => taskRow(c)).join('')}</div>` : ''}
      ${logs.length ? `<div class="db-head"><h2>관련 개발 일지</h2></div><div class="log-list">${logs.map(logRow).join('')}</div>` : ''}
      ${t.commit || t.doc ? '<p class="muted" style="font-size:12px;margin-top:20px">커밋 번호와 근거 문서는 비공개 게임 저장소 기준입니다.</p>' : ''}`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').focus();
  }
  function closeModal(updateHash = true) {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (updateHash && location.hash.includes('?')) history.replaceState(null, '', `#${currentPath()}`);
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---------- 라우터 ----------
  function currentPath() {
    const raw = location.hash.replace(/^#/, '') || '/';
    return raw.split('?')[0] || '/';
  }
  function currentQuery() {
    const raw = location.hash.split('?')[1] || '';
    return new URLSearchParams(raw);
  }
  function setCrumbs(parts) {
    const all = [['잿불 용병단', '#/'], ...parts];
    crumbs.innerHTML = all.map(([label, href], i) => (href && i < all.length - 1 ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join('<span>/</span>');
    document.title = parts.length && parts[parts.length - 1][0] !== '홈' ? `${parts[parts.length - 1][0]} · 잿불 용병단 개발 기록` : '잿불 용병단 개발 기록';
  }
  function markNav(path) {
    const seg = path.split('/').filter(Boolean);
    let key = 'home';
    if (seg[0] === 'design') key = 'design';
    else if (seg[0] === 'tracker') key = seg[1] || 'board';
    else if (seg[0] === 'devlog') key = 'devlog';
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }
  async function route() {
    const path = currentPath();
    const q = currentQuery();
    document.getElementById('sidebar').classList.remove('open');
    if (path !== state.lastPath) {
      state.lastPath = path;
      markNav(path);
      const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
      try {
        if (!seg.length) renderHome();
        else if (seg[0] === 'design') await renderDesign();
        else if (seg[0] === 'tracker') renderTracker(seg[1]);
        else if (seg[0] === 'devlog' && seg[1]) await renderDevlog(seg[1]);
        else if (seg[0] === 'devlog') renderDevlogList();
        else renderNotFound();
      } catch (err) {
        app.innerHTML = `<p class="muted">내용을 불러오지 못했습니다: ${esc(err.message)}</p>`;
      }
      window.scrollTo(0, 0);
    }
    const t = Number(q.get('t'));
    if (t) openTask(t); else closeModal(false);
  }

  // ---------- 테마 · 메뉴 ----------
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* 저장소를 못 쓰면 시스템 설정을 따른다 */ }
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    document.getElementById('theme-btn').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* 무시 */ }
    });
  }
  document.getElementById('menu-btn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));

  // ---------- 시작 ----------
  async function init() {
    initTheme();
    try {
      const [site, tasks, logs] = await Promise.all(['data/site.json', 'data/tasks.json', 'data/devlog.json'].map((p) => fetch(p).then((r) => {
        if (!r.ok) throw new Error(`${p} (${r.status})`);
        return r.json();
      })));
      state.site = site;
      state.tasks = tasks.sort((a, b) => a.key - b.key);
      state.tasks.forEach((t) => { t.parts = t.parts || []; state.byKey.set(t.key, t); });
      state.logs = logs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      if (site.github) document.getElementById('gh-link').href = site.github;
    } catch (err) {
      app.innerHTML = `<p>데이터를 불러오지 못했습니다: ${esc(err.message)}</p><p class="muted">파일을 직접 열었다면 로컬 서버(예: <code>python -m http.server</code>)로 열어 주세요.</p>`;
      return;
    }
    window.addEventListener('hashchange', route);
    route();
  }
  init();
})();
