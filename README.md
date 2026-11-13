# 잿불 용병단 개발 기록

개인 게임 프로젝트 「잿불 용병단」의 작업 트래커와 개발 일지 사이트입니다.
GitHub Pages로 무료 호스팅하며, 빌드 도구 없이 정적 파일만으로 동작합니다.

## 고치는 방법

| 바꿀 것 | 파일 |
| --- | --- |
| 홈 소개 · 한눈에 표 · 걸어온 길 · 원칙 | `data/site.json` |
| 작업 트래커 (보드 · 백로그 · 로드맵 · 에픽) | `data/tasks.json` |
| 개발 일지 목록 | `data/devlog.json` |
| 개발 일지 본문 | `content/devlog/<slug>.md` |
| 기획 요약 | `content/design.md` |

### 작업 추가

`data/tasks.json` 배열에 한 줄을 넣습니다. `key`는 겹치지 않는 번호, `epic`은 상위 에픽의 `key`입니다.

```json
{"key":68,"title":"새 작업","type":"작업","status":"할 일","priority":"보통","milestone":"S2 전투 한 판","parts":["전투"],"epic":9}
```

- `type`: 에픽 · 스토리 · 작업 · 버그
- `status`: 할 일 · 진행 중 · 검토 · 완료 · 중단
- `priority`: 최상 · 높음 · 보통 · 낮음
- 선택 항목: `start`, `end`(YYYY-MM-DD), `commit`, `doc`, `memo`
- 새 마일스톤을 쓰려면 `app.js`의 `MILESTONES` 배열에도 추가합니다.

### 일지 추가

1. `content/devlog/2026-11-20-제목.md`에 본문을 Markdown으로 씁니다. (`##` 제목, `-` 목록, 표, 코드 블록, `**굵게**` 지원)
2. `data/devlog.json` 맨 앞에 `{"slug":"2026-11-20-제목","date":"2026-11-20","title":"…","summary":"…","tags":["구현"],"tasks":[53]}`를 넣습니다.

## 로컬에서 보기

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. (`index.html`을 파일로 직접 열면 데이터 파일을 읽지 못합니다.)

## 수정 권한

이 저장소에 커밋할 수 있는 사람만 내용을 바꿀 수 있습니다. 방문자는 읽기만 합니다.
