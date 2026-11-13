/* 잿불 용병단 작업 트래커 (Chirpy 탭 안에서 동작).
   데이터 원본: _data/tasks.json (작업), _posts (개발 일지).
   주소 형식: /projects/ember/tracker/?view=board|backlog|roadmap|epics&t=<작업 번호> */
(() => {
  'use strict';

  const root = document.getElementById('ember-root');
  if (!root) return;
  const base = root.dataset.base || '/';
  const app = document.getElementById('ember-app');
  const modal = document.getElementById('ember-modal');
  const modalBody = document.getElementById('ember-modal-body');

  const KEY_PREFIX = 'EMBER';
  const VIEWS = { board: '보드', backlog: '백로그', roadmap: '로드맵', epics: '에픽' };
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
  // 새 마일스톤을 쓰면 여기에도 순서대로 넣는다.
  const MILESTONES = [
    '초기 탐색', '게임회사 경영', '용병단 모바일', '룬 릴 M0', '룬 릴 M1', '개발 환경',
    'S0 긁기 손맛', 'S1 전투 시뮬레이션', 'S2 전투 한 판', 'S3 런 하나', 'S4 거점과 메타', 'S5 Steam 데모',
  ];
  // GitHub Pages 는 파일을 10분까지 브라우저에 저장해 두게 한다. no-cache 는 매번 서버에 바뀌었는지 묻는다.
  const FRESH = { cache: 'no-cache' };

  const state = {
    tasks: [], byKey: new Map(), logs: [],
    filter: { milestone: '', epic: '', part: '', type: '', q: '' },
    collapsed: null, view: null,
  };

  // ---------- 공용 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyText = (k) => `${KEY_PREFIX}-${k}`;
  const tag = (text, color) => `<span class="et-tag ${color || 'gray'}">${esc(text)}</span>`;
  const statusTag = (s, keep) => `<span class="et-status et-tag ${STATUS_COLOR[s] || 'gray'}${keep ? ' keep' : ''}">${esc(s)}</span>`;
  const typeIcon = (t) => { const i = TYPE_INFO[t] || TYPE_INFO['작업']; return `<span class="et-ticon ${i.cls}" title="${esc(t)}">${i.ch}</span>`; };
  const prioIcon = (p) => { const i = PRIO_INFO[p] || PRIO_INFO['보통']; return `<span class="et-prio ${i.cls}" title="우선순위 ${esc(p)}">${i.ch}</span>`; };
  const partTags = (parts) => `<span class="et-tags">${(parts || []).map((p) => tag(p, PART_COLOR[p])).join('')}</span>`;
  const fmtDate = (d) => (d ? d.replaceAll('-', '.') : '');
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isEpic = (t) => t.type === '에픽';
  const children = (epicKey) => state.tasks.filter((t) => t.epic === epicKey);

  function href(view, t) {
    const p = new URLSearchParams();
    p.set('view', view || state.view || 'board');
    if (t) p.set('t', t);
    return `?${p.toString()}`;
  }
  const taskHref = (k) => href(state.view, k);

  function progress(list) {
    const total = list.length;
    const done = list.filter((t) => t.status === '완료').length;
    const doing = list.filter((t) => t.status === '진행 중' || t.status === '검토').length;
    const stop = list.filter((t) => t.status === '중단').length;
    return { total, done, doing, stop };
  }
  function progressBar(p) {
    if (!p.total) return '<div class="et-bar"></div>';
    const w = (n) => `${(n / p.total) * 100}%`;
    return `<div class="et-bar" title="완료 ${p.done} · 진행 ${p.doing} · 중단 ${p.stop} / 전체 ${p.total}"><i class="b-done" style="width:${w(p.done)}"></i><i class="b-doing" style="width:${w(p.doing)}"></i><i class="b-stop" style="width:${w(p.stop)}"></i></div>`;
  }

  // ---------- 행 · 카드 ----------
  function taskRow(t, opts = {}) {
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    return `<a class="et-row" href="${taskHref(t.key)}">
      ${typeIcon(t.type)}<span class="et-key">${keyText(t.key)}</span>
      <span class="rt">${esc(t.title)}</span>
      <span class="rm">${opts.showEpic && epic ? tag(epic.title, 'purple') : ''}${partTags(t.parts)}${prioIcon(t.priority)}${statusTag(t.status, true)}</span>
    </a>`;
  }
  function taskCard(t) {
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    return `<a class="et-card" href="${taskHref(t.key)}">
      <div class="ct">${esc(t.title)}</div>
      ${epic ? `<div class="cepic">${tag(epic.title, 'purple')}</div>` : ''}
      <div class="cf">${typeIcon(t.type)}${prioIcon(t.priority)}${partTags(t.parts.slice(0, 2))}<span class="et-key">${keyText(t.key)}</span></div>
    </a>`;
  }

  // ---------- 필터 ----------
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
    return `<div class="et-filters">
      <input type="search" data-f="q" placeholder="제목 · 키 검색" value="${esc(f.q)}" aria-label="작업 검색">
      <select data-f="milestone" aria-label="마일스톤">${opt('', '마일스톤: 전체', f.milestone)}${MILESTONES.map((m) => opt(m, m, f.milestone)).join('')}</select>
      <select data-f="epic" aria-label="에픽">${opt('', '에픽: 전체', f.epic)}${epics.map((e) => opt(String(e.key), e.title, f.epic)).join('')}</select>
      <select data-f="part" aria-label="파트">${opt('', '파트: 전체', f.part)}${parts.map((p) => opt(p, p, f.part)).join('')}</select>
      <select data-f="type" aria-label="유형">${opt('', '유형: 전체', f.type)}${['스토리', '작업', '버그'].map((p) => opt(p, p, f.type)).join('')}</select>
      <button class="et-reset" type="button" data-reset>초기화</button>
      <span class="et-count">${count}건</span>
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

  // ---------- 머리 ----------
  function header(view) {
    const items = state.tasks.filter((t) => !isEpic(t));
    const p = progress(items);
    const tabs = [['board', '▦ 보드'], ['backlog', '☰ 백로그'], ['roadmap', '▬ 로드맵'], ['epics', '⚡ 에픽']];
    return `<div class="et-stats">
        <div class="et-stat"><b>${p.total}</b><span>전체 작업 (에픽 제외)</span></div>
        <div class="et-stat"><b>${p.done}</b><span>완료</span></div>
        <div class="et-stat"><b>${p.doing}</b><span>진행 중 · 검토</span></div>
        <div class="et-stat"><b>${state.tasks.filter(isEpic).length}</b><span>에픽</span></div>
      </div>
      <p class="et-muted et-sub">Jira처럼 키는 ${KEY_PREFIX}-번호입니다. 카드를 누르면 상세가 열립니다.</p>
      <nav class="et-tabs" aria-label="트래커 화면">${tabs.map(([k, l]) => `<a href="${href(k)}" class="${k === view ? 'active' : ''}"${k === view ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  }

  // ---------- 보드 ----------
  function renderBoard() {
    const list = filtered();
    const cols = STATUSES.map((s) => {
      const items = list.filter((t) => t.status === s);
      return `<section class="et-col" aria-label="${esc(s)}"><div class="et-col-head">${statusTag(s)}<span class="n">${items.length}</span></div>
        ${items.map(taskCard).join('') || '<div class="et-col-empty">비어 있음</div>'}</section>`;
    }).join('');
    app.innerHTML = `${header('board')}${filterBar(list.length)}<div class="et-board">${cols}</div>`;
    bindFilters(renderBoard);
  }

  // ---------- 백로그 ----------
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
      return `<section class="et-sprint ${state.collapsed.has(m) ? 'collapsed' : ''}" data-m="${esc(m)}">
        <div class="et-sprint-head" role="button" tabindex="0" aria-expanded="${!state.collapsed.has(m)}"><span class="caret">▼</span><b>${esc(m)}</b>
          <span class="sp-meta">${range} · ${items.length}건 · 완료 ${p.done}/${p.total}</span>${progressBar(p)}</div>
        <div class="et-rows">${items.map((t) => taskRow(t)).join('')}</div>
      </section>`;
    }).join('');
    app.innerHTML = `${header('backlog')}${filterBar(list.length)}${groups || '<p class="et-muted">조건에 맞는 작업이 없습니다.</p>'}`;
    bindFilters(renderBacklog);
    app.querySelectorAll('.et-sprint-head').forEach((h) => {
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

  // ---------- 로드맵 ----------
  function renderRoadmap() {
    const epics = state.tasks.filter(isEpic);
    const now = today();
    const starts = epics.map((e) => e.start).filter(Boolean).map(parseDate);
    const ends = epics.map((e) => e.end).filter(Boolean).map(parseDate);
    const minD = starts.length ? new Date(Math.min(...starts)) : now;
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
        bar = '<span class="et-muted" style="font-size:12px;padding-left:12px">일정 미정</span>';
      } else {
        const s = parseDate(e.start);
        const end = e.end ? new Date(parseDate(e.end).getTime() + dayMs) : new Date(now.getTime() + dayMs);
        const cls = e.status === '완료' ? 'done' : e.status === '중단' ? 'stop' : e.status === '할 일' ? 'todo' : 'doing';
        bar = `<a class="rm-bar ${cls}" href="${taskHref(e.key)}" style="left:${pct(s)}%;width:${Math.max(pct(end) - pct(s), 0.6)}%" title="${esc(e.title)} · ${fmtDate(e.start)} ~ ${e.end ? fmtDate(e.end) : '진행 중'}">${p.done}/${p.total}</a>`;
      }
      return `<a class="rm-cell rm-name" href="${taskHref(e.key)}">${typeIcon('에픽')}<span class="t">${esc(e.title)}</span></a>
        <div class="rm-cell rm-track"><div class="rm-lines">${months.map(() => '<div></div>').join('')}</div>${bar}</div>`;
    }).join('');
    const todayLine = now >= from && now < to ? `<div class="rm-today" style="left:calc(220px + (100% - 220px) * ${pct(now) / 100})"></div>` : '';
    app.innerHTML = `${header('roadmap')}
      <div class="et-roadmap"><div class="rm-grid">
        <div class="rm-cell rm-name rm-head">에픽</div>
        <div class="rm-cell rm-track rm-head"><div class="rm-months">${months.map((m) => `<div>${m.getFullYear()}.${String(m.getMonth() + 1).padStart(2, '0')}</div>`).join('')}</div></div>
        ${rows}${todayLine}
      </div></div>
      <p class="et-note">막대 안 숫자는 하위 작업 완료/전체. 초록 = 완료, 파랑 = 진행 중(오늘까지), 회색 = 중단. 시작하지 않은 에픽은 날짜를 지어내지 않고 "일정 미정"으로 둡니다.</p>`;
  }

  // ---------- 에픽 ----------
  function renderEpics() {
    const epics = state.tasks.filter(isEpic);
    app.innerHTML = `${header('epics')}<div class="et-epics">${epics.map((e) => {
      const p = progress(children(e.key));
      return `<a class="et-epic" href="${taskHref(e.key)}">
        <div class="et-epic-title">${typeIcon('에픽')}<span>${esc(e.title)}</span></div>
        <div>${statusTag(e.status)} ${tag(e.milestone, 'gray')}</div>
        <div class="et-epic-memo">${esc(e.memo || '')}</div>
        <div class="et-epic-foot">${progressBar(p)}<span>${p.done}/${p.total}</span><span class="et-key">${keyText(e.key)}</span></div>
      </a>`;
    }).join('')}</div>`;
  }

  // ---------- 작업 상세 ----------
  function logRow(l) {
    return `<a class="et-log" href="${esc(l.url)}">
      <span class="et-log-date">${fmtDate(l.date)}</span>
      <span><span class="et-log-title">${esc(l.title)}</span><span class="et-log-sum">${esc(l.summary || '')}</span></span>
    </a>`;
  }
  function openTask(k) {
    const t = state.byKey.get(k);
    if (!t) { closeModal(false); return; }
    const epic = t.epic ? state.byKey.get(t.epic) : null;
    const kids = isEpic(t) ? children(t.key) : [];
    const logs = state.logs.filter((l) => (l.tasks || []).includes(t.key));
    const prop = (label, val) => `<dt>${label}</dt><dd class="${val ? '' : 'empty'}">${val || '비어 있음'}</dd>`;
    const period = t.start ? `${fmtDate(t.start)} → ${t.end ? fmtDate(t.end) : (t.status === '진행 중' ? '진행 중' : '')}` : '';
    modalBody.innerHTML = `
      <div class="et-modal-key">${typeIcon(t.type)}<span class="et-key">${keyText(t.key)}</span></div>
      <div id="ember-modal-title" class="et-modal-title">${esc(t.title)}</div>
      <dl class="et-props">
        ${prop('상태', statusTag(t.status))}
        ${prop('유형', `${typeIcon(t.type)} ${esc(t.type)}`)}
        ${prop('우선순위', `${prioIcon(t.priority)} ${esc(t.priority)}`)}
        ${prop('마일스톤', tag(t.milestone, 'gray'))}
        ${prop('파트', partTags(t.parts))}
        ${isEpic(t) ? '' : prop('상위 에픽', epic ? `<a class="et-link" href="${taskHref(epic.key)}">${typeIcon('에픽')} ${esc(epic.title)}</a>` : '')}
        ${prop('기간', esc(period))}
        ${prop('커밋', t.commit ? `<code>${esc(t.commit)}</code>` : '')}
        ${prop('근거 문서', t.doc ? esc(t.doc) : '')}
      </dl>
      ${t.memo ? `<div class="et-callout">📝 ${esc(t.memo)}</div>` : ''}
      ${kids.length ? `<div class="et-section">하위 작업 <span class="et-muted">${progress(kids).done}/${kids.length} 완료</span></div>
        <div style="margin:6px 0 10px">${progressBar(progress(kids))}</div>
        <div class="et-rows">${kids.map((c) => taskRow(c)).join('')}</div>` : ''}
      ${logs.length ? `<div class="et-section">관련 개발 일지</div><div class="et-logs">${logs.map(logRow).join('')}</div>` : ''}
      ${t.commit || t.doc ? '<p class="et-muted" style="font-size:12px;margin-top:20px">커밋 번호와 근거 문서는 따로 적지 않으면 비공개 게임 저장소 기준입니다.</p>' : ''}`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.et-modal-close').focus();
  }
  function closeModal(updateUrl = true) {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (updateUrl && new URLSearchParams(location.search).has('t')) history.pushState(null, '', href(state.view));
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---------- 주소 ----------
  function route() {
    const q = new URLSearchParams(location.search);
    let view = q.get('view');
    if (!VIEWS[view]) view = 'board';
    if (view !== state.view) {
      state.view = view;
      ({ board: renderBoard, backlog: renderBacklog, roadmap: renderRoadmap, epics: renderEpics })[view]();
    }
    const t = Number(q.get('t'));
    if (t) openTask(t); else closeModal(false);
  }
  // 트래커 안의 ?view=…&t=… 링크는 페이지를 다시 불러오지 않고 처리한다.
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="?"]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    route();
  });
  window.addEventListener('popstate', route);

  // ---------- 시작 ----------
  async function init() {
    try {
      const [tasks, logs] = await Promise.all([`${base}assets/data/tasks.json`, `${base}assets/data/devlog.json`].map((p) => fetch(p, FRESH).then((r) => {
        if (!r.ok) throw new Error(`${p} (${r.status})`);
        return r.json();
      })));
      state.tasks = tasks.sort((a, b) => a.key - b.key);
      state.tasks.forEach((t) => { t.parts = t.parts || []; state.byKey.set(t.key, t); });
      state.logs = logs;
    } catch (err) {
      app.innerHTML = `<p>작업 목록을 불러오지 못했습니다: ${esc(err.message)}</p>`;
      return;
    }
    route();
  }
  init();
})();
