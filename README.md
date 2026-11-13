# 박인환 개발 블로그

Unity 클라이언트 프로그래머 박인환을 소개하고, 진행하는 프로젝트의 개발 일지와 작업 기록을 담는 블로그입니다.
주소: https://inhwan98.github.io

블로그 전체는 개인 소개이고, 게임 프로젝트는 `프로젝트` 탭 아래 하나씩 들어갑니다.
지금 있는 프로젝트는 「잿불 용병단」(`/projects/ember/`) 하나입니다.

- 테마: [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) (MIT). 빌드 설정은 [chirpy-starter](https://github.com/cotes2020/chirpy-starter)에서 가져왔습니다.
- 호스팅: GitHub Pages. `main`에 올리면 GitHub Actions(`.github/workflows/pages-deploy.yml`)가 빌드해 배포합니다. 공개 저장소라 비용이 없습니다.
- 수정 권한: 이 저장소에 커밋할 수 있는 사람만 바꿀 수 있습니다. 방문자는 읽기만 합니다.

## 고치는 방법

| 바꿀 것 | 파일 |
| --- | --- |
| 사이트 제목 · 소개 문구 · 테마 설정 | `_config.yml` |
| 소개 탭 (나에 대한 소개) | `_tabs/about.md` |
| 프로젝트 탭 (프로젝트 목록) | `_tabs/projects.md` |
| 잿불 용병단 소개 | `projects/ember/index.md` |
| 잿불 용병단 기획 요약 | `projects/ember/design.md` |
| 잿불 용병단 작업 트래커 데이터 | `_data/tasks.json` |
| 잿불 용병단 작업 트래커 화면 | `projects/ember/tracker.html`, `assets/js/ember-tracker.js`, `assets/css/ember-tracker.css` |
| 개발 일지 글 | `_posts/YYYY-MM-DD-영문-슬러그.md` |
| 옛 주소(`/tracker/`, `/design/`) 이동 | `redirects/` |

### 프로젝트 추가

1. `projects/<영문-이름>/index.md`에 소개 페이지를 만듭니다. 머리에 `layout: page`, `title`, `permalink: /projects/<영문-이름>/`을 적습니다.
2. `_tabs/projects.md`와 `_tabs/about.md`의 프로젝트 표에 한 줄씩 추가합니다.
3. 일지 글의 첫째 분류를 그 프로젝트 이름으로 씁니다.

### 일지 글 추가

`_posts/2026-11-20-scratch-s0.md` 처럼 만듭니다. 파일 이름의 날짜 뒤 부분이 주소(`/posts/scratch-s0/`)가 되므로 영문 소문자와 `-`만 씁니다.

```markdown
---
title: "긁기 손맛 시제품 S0"
date: 2026-11-20 18:00:00 +0900
categories: [잿불 용병단, 긁는 복권]
tags: [구현, 검증]
description: "목록에 보이는 한 줄 요약"
tasks: [53, 54]
---

## 한 일

- ...

## 확인한 것

- 테스트 · 시뮬레이션 · 캡처 등 근거와 수치

## 확인하지 못한 것

- ...

{% include related-tasks.html %}
```

- `categories`: 첫째는 프로젝트 이름(지금은 `잿불 용병단`), 둘째는 그 프로젝트 안의 단계(`초기 탐색`, `고블린 게임회사`, `용병단 모바일`, `룬 릴`, `긁는 복권`, `개발 환경` 등). 특정 프로젝트에 속하지 않는 글은 첫째 분류에 주제(예: `Unity`, `회고`)를 씁니다.
- `tags`: `구현` · `기획` · `검증` · `조사` · `전환` · `도구` 중에서 고릅니다.
- `tasks`: `_data/tasks.json`의 작업 번호. 글 아래 '관련 작업' 상자와 트래커 상세 창의 '관련 개발 일지'가 이 값으로 이어집니다.
- 본문에 `{{`나 `{%`를 그대로 쓰면 Liquid 문법으로 읽힙니다. 코드에 꼭 필요하면 `{% raw %}` … `{% endraw %}`로 감쌉니다.

### 작업 추가 · 상태 변경

`_data/tasks.json` 배열을 고칩니다. `key`는 겹치지 않는 번호, `epic`은 상위 에픽의 `key`입니다.

```json
{"key":68,"title":"새 작업","type":"작업","status":"할 일","priority":"보통","milestone":"S2 전투 한 판","parts":["전투"],"epic":9}
```

- `type`: 에픽 · 스토리 · 작업 · 버그
- `status`: 할 일 · 진행 중 · 검토 · 완료 · 중단
- `priority`: 최상 · 높음 · 보통 · 낮음
- 선택 항목: `start`, `end`(YYYY-MM-DD), `commit`, `doc`, `memo`
- 새 마일스톤을 쓰려면 `assets/js/ember-tracker.js`의 `MILESTONES` 배열에도 추가합니다.

## 다른 작업 세션에서 갱신하는 절차

게임 저장소에서 기능 · 기획 · 검증 작업을 마친 세션은 이 순서로 갱신합니다.

1. `_data/tasks.json`: 끝낸 작업은 `status`를 `완료`로, `end` · `commit`(게임 저장소 커밋 앞 7자리) · `doc`(근거 문서 이름)을 채웁니다. 새로 생긴 작업은 행을 추가합니다.
2. 의미 있는 진척(기능 완성, 기획 결정, 검증 결과, 방향 전환)이면 `_posts/`에 일지 글을 하나 씁니다. 사소한 수정은 작업 상태만 바꿉니다.
3. 근거가 있는 수치만 씁니다. 시뮬레이션 · 자동 검사는 사람 플레이 검증과 구분해 적습니다.
4. 비공개 게임 저장소의 코드, 구매 에셋 원본, 개인 이메일, 이전 소속 자료는 넣지 않습니다.
5. 커밋과 `main` push는 사용자가 요청할 때만 합니다. 커밋 작성자 이메일은 이 저장소 설정의 GitHub noreply 주소를 씁니다.

## 로컬에서 보기 (선택)

Ruby와 Bundler가 있으면 `bundle install` 후 `bundle exec jekyll s`로 `http://127.0.0.1:4000`에서 볼 수 있습니다. 없으면 push 후 Actions 빌드 결과로 확인합니다.
