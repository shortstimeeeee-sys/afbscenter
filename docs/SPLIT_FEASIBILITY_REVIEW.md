# 컨트롤러/JS 분리 기능 영향 검토

**목적:** URL·전역 함수를 유지한 채 로직만 다른 클래스/파일로 나눴을 때 기능이 깨지지 않는지 검토.

---

## 1. 컨트롤러 분리

### 1.1 현재 구조

| 컨트롤러 | Base path | 매핑 개수 | 비고 |
|----------|-----------|-----------|------|
| MemberController | `/api/members` | 22개 | GetMapping 12, PostMapping 4, PutMapping 1, DeleteMapping 5 |
| BookingController | `/api/bookings` | 14개 | GetMapping 8, PostMapping 3, PutMapping 1, DeleteMapping 1 |

- **경로 충돌 없음:** 같은 (HTTP 메서드 + path) 조합이 두 번 정의된 곳 없음.
- **PathVariable:** `@GetMapping("/{id}")`, `@GetMapping("/{memberId}/products")` 등 path 변수명이 제각각이지만, 분리 시 **매핑을 그대로 옮기기만** 하면 됨. 변수명 변경 불필요.

### 1.2 분리 시 유지할 것

- `@RequestMapping("/api/members")` 또는 `/api/bookings` → **동일 유지**
- 각 메서드의 `@GetMapping(...)` 등 path → **동일 유지**
- 요청/응답 형식(바디, 쿼리 파라미터) → **변경 없음**

→ **이 세 가지만 지키면** 브라우저/프론트가 호출하는 API 주소와 응답이 그대로이므로 **기능은 그대로**입니다.

### 1.3 분리 시 주의점 (실수 시에만 문제)

| 항목 | 위험 | 방지 방법 |
|------|------|-----------|
| 매핑 누락 | 새 클래스로 옮기다 일부 메서드 빠뜨림 | 분리 전 전체 매핑 목록 적어두고, 분리 후 개수·path 일치 확인 |
| PathVariable/파라미터 이름 변경 | 바인딩 오류 | 기존 시그니처 그대로 복사 (변수명 포함) |
| 서비스/Repository 주입 | 새 컨트롤러에서 필요한 빈 미주입 | 기존 컨트롤러가 쓰는 생성자 주입 그대로 새 클래스에 복사 후 사용하는 것만 남김 |

### 1.4 결론 (컨트롤러)

- **로직만 다른 클래스로 옮기고, URL·메서드 시그니처·응답 형식을 그대로 두면 기능 문제 없음.**
- 문제는 **분리 과정에서 매핑 누락·시그니처 변경·빈 주입 누락** 같은 실수에서만 발생. 체크리스트로 점검하면 방지 가능.

---

## 2. JS 분리

### 2.1 현재 구조 (요약)

- **members.js:** 전역 함수 다수 + `window.renderProductsList`, `window.openAdjustCountModal` 등 일부만 `window`에 명시적 할당. 나머지는 스크립트가 한 파일이라 전역으로 노출됨.
- **bookings.js:** `window.BOOKING_PAGE_CONFIG` 사용, `window.calendarFilterCoachIds` 등. HTML에서 `onclick="openBookingModal()"`, `onclick="saveBooking()"` 등으로 호출.
- **HTML:** `<script src="/js/common.js"></script>` 다음에 `<script src="/js/members.js"></script>` 또는 `bookings.js` **한 개만** 로드.

### 2.2 분리 시 유지할 것

- **전역 이름:** HTML/다른 스크립트에서 부르는 함수명·변수명 변경 금지 (예: `openMemberModal`, `saveBooking`, `applyFilters`).
- **로드 순서:** `common.js` → (의존하는 모듈 순) → 기존에 쓰이던 진입 스크립트 순서.  
  - 예: `members-utils.js` → `members-stats.js` → `members-main.js` 처럼 “쓰는 쪽”이 “정의된 쪽”보다 뒤에 오도록.

→ **이 두 가지만 지키면** 기존처럼 전역에서 같은 이름으로 호출되므로 **동작은 동일**하게 유지할 수 있습니다.

### 2.3 분리 시 주의점 (실수 시에만 문제)

| 항목 | 위험 | 방지 방법 |
|------|------|-----------|
| 스크립트 로드 순서 | 정의 전에 호출 → ReferenceError | A에서 B 함수 쓸 경우 A를 로드하는 `<script>`가 B보다 뒤에 오도록 |
| `window.xxx` 누락 | 분리 후 일부만 새 파일에 두면, 다른 스크립트에서 `window.xxx` 기대할 때 undefined | 분리 전에 `window.`에 넣는 것 목록 정리, 분리 후에도 동일하게 유지 |
| HTML에서 호출하는 이름 변경 | onclick 등에서 호출 실패 | 함수명/변수명 검색해서 HTML과 일치 여부 확인 |

### 2.4 결론 (JS)

- **전역 변수·함수 이름을 바꾸지 않고, 기존 한 파일 내용만 여러 파일로 나누고, HTML에서 `<script>` 로드 순서만 맞추면 동작은 동일하게 유지 가능.**
- 문제는 **로드 순서 잘못·window 할당 누락·이름 변경** 같은 실수에서만 발생. 분리 후 해당 페이지만 열어서 클릭/저장 테스트하면 확인 가능.

---

## 3. 종합

- **분리 자체가 기능을 바꾸지는 않습니다.**  
  - 컨트롤러: URL·메서드·응답 그대로 두고 구현만 이동.  
  - JS: 전역 이름·로드 순서 유지하고 코드만 파일 단위로 나눔.
- **기능에 문제가 생기는 경우는** 위 표에 적은 것처럼 **분리 과정에서의 실수**일 때뿐입니다.  
  - 매핑/시그니처/빈 주입(컨트롤러), 로드 순서/window/이름(JS)만 점검하면 **기능 유지한 채 분리 가능**하다고 판단할 수 있습니다.
