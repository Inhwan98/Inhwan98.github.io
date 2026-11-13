---
icon: fas fa-folder-open
order: 2
---

{%- assign ember_log = '잿불 용병단' | slugify | url_encode | prepend: '/categories/' | append: '/' | relative_url -%}

진행 중이거나 끝낸 프로젝트를 모읍니다. 프로젝트마다 소개 · 작업 기록 · 개발 일지가 따로 있습니다.

## 잿불 용병단 (가칭)

2026.08 ~ 개발 중 · 1인 개발 · Unity 6 · PC Steam
{: .text-muted }

동전으로 복권을 긁어 용병단을 싸우게 하는 턴제 로그라이크입니다.
모바일 경영 시뮬레이션에서 시작해, 시제품과 검증 결과를 보며 지금의 긁는 복권 로그라이크로 방향을 바꿔 왔습니다.

- [프로젝트 소개]({{ '/projects/ember/' | relative_url }})
- [작업 트래커]({{ '/projects/ember/tracker/' | relative_url }})
- [기획 요약]({{ '/projects/ember/design/' | relative_url }})
- [개발 일지]({{ ember_log }})
