# AFBS Center 기능 점검 보고서

| 항목 | 내용 |
|------|------|
| 프로젝트 | AFBS Center (스포츠 운영 센터) |
| 경로 | `C:\Users\seo\Desktop\afbscenter` |
| 점검일 | 2026-09-04 |
| 점검 범위 | 전체 구조 리뷰 + 실행 중 서버 기준 기능 스모크 테스트 |
| 스택 | Spring Boot 3.2, Java 17, H2, JPA, 정적 HTML/JS/CSS |
| 빌드 | `mvn compile -DskipTests` → **성공** |
| 서버 | `http://localhost:8080` (점검 시점 기동 중) |

관련 과거 문서: [PROJECT_AUDIT_2026.md](PROJECT_AUDIT_2026.md), [PROJECT_REVIEW_FULL.md](PROJECT_REVIEW_FULL.md), [PROJECT_REVIEW_2026.md](PROJECT_REVIEW_2026.md)

---

## 1. 종합 판정

**일상 운영 경로(로그인·대시보드·회원·예약 필터 조회·코치·공개 회원예약)는 통과.**  
다만 **이용권 미연결 예약 페이지 Admin 체크 버그**, **예약/출석 무필터 대용량 응답**, **공개 API·기본 시크릿**은 우선 대응이 필요하다.

| 영역 | 상태 | 요약 |
|------|------|------|
| 빌드/기동 | ✅ | 컴파일 성공, 서버 응답 정상 |
| 정적 페이지 | ✅ | 점검한 HTML 20개 모두 HTTP 200 |
| 인증(JWT) | ✅ | 로그인·`/api/auth/me` 정상, 미인증 보호 API 401 |
| 대시보드 | ✅ | KPI·알림·오늘 일정·공지·만료 회원 API 정상·저지연 |
| 회원/코치/상품/결제 | ✅ | 목록·핵심 조회 API 정상 |
| 예약(필터 있음) | ✅ | `date=` 또는 ISO `start`/`end` 사용 시 정상 |
| 공개 회원예약 | ✅ | verify·기간 캘린더 정상 |
| 코치 고유색 | ✅ | 활성 코치 12명, 색 중복 없음 |
| 이용권 미연결 예약 UI | ❌ | Admin 체크 타이밍 버그 가능 |
| 성능(무필터 예약/출석) | ⚠️ | 전체 조회 시 수 MB·수 초 |
| 보안(운영 준비) | ⚠️ | 공개 회원번호 API, JWT/초기비번 기본값 |
| 자동화 테스트 | ⚠️ | `contextLoads` 1건만 존재 |

---

## 2. 점검 방법

1. 소스·컨트롤러·프론트(`static`) 정적 리뷰
2. `mvn compile -DskipTests`
3. 기동 서버에 대해 페이지 GET + 로그인 후 주요 REST 호출
4. 공개 API·미인증 접근·성능(응답 크기/지연) 측정

---

## 3. 통과한 기능 체크리스트

### 3.1 정적 페이지 (HTTP 200)

| 페이지 | 결과 |
|--------|------|
| `/login.html` | ✅ |
| `/` (대시보드) | ✅ |
| `/members.html` | ✅ |
| `/coaches.html` | ✅ |
| `/bookings.html`, `/bookings-yeonsan.html` 등 예약 계열 | ✅ |
| `/bookings-without-product.html` | ✅ (HTML 로드만; 권한 로직 이슈는 §5) |
| `/attendance.html` | ✅ |
| `/payments.html`, `/products.html` | ✅ |
| `/rentals.html`, `/facilities.html` | ✅ |
| `/analytics.html`, `/announcements.html` | ✅ |
| `/settings.html`, `/users.html` | ✅ |
| `/member-booking.html`, `/rankings.html` | ✅ |
| `/training-logs.html`, `/baseball-records.html` | ✅ |

### 3.2 인증

| 항목 | 결과 | 비고 |
|------|------|------|
| `POST /api/auth/login` | ✅ | 토큰·role·username 반환 |
| `GET /api/auth/me` (Bearer) | ✅ | |
| 보호 API 무토큰 | ✅ | `/api/members`, `/users`, `/settings`, `/db-status` → 401 |
| `GET /api/coaches` 무토큰 | ✅ | 401 (로그인 페이지 프리로드 루프 방지와 정합) |
| `common.js` 401/공개 경로 가드 | ✅ | `login` / `member-booking` / `rankings` 에서 리다이렉트 생략 |

### 3.3 대시보드 API

| API | 결과 | 비고(점검 시점) |
|-----|------|----------------|
| `GET /api/dashboard/kpi` | ✅ | ~50ms |
| `GET /api/dashboard/alerts` | ✅ | |
| `GET /api/dashboard/today-schedule` | ✅ | |
| `GET /api/dashboard/announcements` | ✅ | |
| `GET /api/dashboard/expiring-members` | ✅ | |
| `GET /api/dashboard/revenue-metrics` | ✅ | |

참고: `/api/dashboard/summary`, `/api/analytics/overview` 등은 **미존재(404)**. 프론트는 위 실제 경로를 사용.

### 3.4 핵심 업무 API

| API | 결과 |
|-----|------|
| `GET /api/coaches`, `/api/coaches/active` | ✅ |
| `GET /api/members` | ✅ |
| `GET /api/products` | ✅ |
| `GET /api/payments` | ✅ |
| `GET /api/facilities` | ✅ |
| `GET /api/announcements` | ✅ |
| `GET /api/member-approvals/pending` | ✅ |
| `GET /api/bookings/without-member-product` | ✅ (응답 큼) |
| `GET /api/bookings/stats`, `/pending`, `/non-members` | ✅ |
| `GET /api/bookings/stats/rentals`, `/pending/rentals` | ✅ |
| `GET /api/settings`, `/api/role-permissions`, `/api/users` | ✅ |
| `GET /api/training-logs/rankings` | ✅ |
| `GET /api/analytics` | ✅ |

### 3.5 예약 조회 (필터)

| 조건 | 결과 | 비고 |
|------|------|------|
| `?date=YYYY-MM-DD` | ✅ | 단일일 조회 |
| `?start=&end=` (ISO-8601, `toISOString()` 형식) | ✅ | 예: 2026-08 구간 603건, ~1.3초, ~492KB |
| `?start=&end=&branch=RENTAL` | ✅ | 대관 필터 |
| 프론트 `bookings.js` / `rentals.js` | ✅ | ISO `start`/`end` 사용 |

### 3.6 공개 회원 예약

| API | 결과 |
|-----|------|
| `POST /api/public/member-booking/verify` (유효 회원번호) | ✅ |
| `POST .../verify` (존재하지 않는 번호) | ✅ (오류 응답) |
| `GET .../calendar?start&end&memberNumber&memberId` | ✅ |
| `GET .../calendar?start&end` (회원번호 없음) | ✅ 빈 배열 (전체 예약 유출 아님) |

### 3.7 코치 고유색

| 항목 | 결과 |
|------|------|
| 활성 코치 색 유일성 | ✅ 12명 / 12색 |
| 서정훈 `#FFFFFF` | 의도값 (`CoachColorPalette.PREFERRED_BY_BASE_NAME`) |

---

## 4. 성능 실측 (점검 시점 DB 기준)

| 호출 | 지연 | 응답 크기 | 판정 |
|------|------|-----------|------|
| `/api/dashboard/kpi` 등 | ~30–50ms | 소량 | ✅ |
| `/api/bookings?start&end` (ISO, 1개월) | ~1.3s | ~492KB | 허용 가능 |
| `/api/bookings` (파라미터 없음) | ~6s | ~2.7MB | ⚠️ 문제 |
| `/api/bookings?page=0&size=20` | ~6s | ~2.7MB | ⚠️ `page`/`size` 미적용 |
| `/api/attendance` (날짜 없음) | ~1.2s | ~1.0MB | ⚠️ |
| `/api/attendance?startDate&endDate` | ~0.2s | ~169KB | ✅ |
| `/api/lessons` | — | ~1.3MB | ⚠️ 대용량 |
| `/api/member-products?page=0&size=5` | ~0.2s | ~160KB | ⚠️ 페이징 체감 약함 |
| `/api/bookings/without-member-product` | ~0.5s | ~467KB | ⚠️ |

---

## 5. 이슈 목록 (조치 추적)

상태 값: `미조치` / `진행중` / `완료` / `보류`

### 5.1 높음

| ID | 이슈 | 근거 | 권장 조치 | 상태 |
|----|------|------|-----------|------|
| H1 | `bookings-without-product.html` Admin 체크가 `restoreAuth` 전에 실행 | 인라인 스크립트가 `App.currentRole`을 즉시 읽어 Admin도 차단될 수 있음 | `DOMContentLoaded` + `restoreAuth` 이후에 역할 검사 | 미조치 |
| H2 | 예약/출석 등 무필터·전체 조회 대용량 | `/api/bookings` 무파라미터 시 전체 `findAll` | 기본 기간 강제, 페이징, 또는 무필터 거부(400) | 미조치 |
| H3 | 공개 API가 회원번호만으로 민감 정보 접근 | `/api/public/member-booking/**` | 추가 인증(OTP/전화 끝자리 등), 응답 필드 최소화 | 미조치 |
| H4 | JWT·관리자 초기 비밀번호 기본값 | `application.properties` | 운영에서 `JWT_SECRET`, `ADMIN_INIT_PASSWORD` 필수화, `init-admin` 제한 | 미조치 |
| H5 | API 역할(RBAC) 검사 불균일 | 유효 JWT만으로 다수 관리 API 호출 가능 | 민감 엔드포인트에 역할 검사 확대 | 미조치 |

### 5.2 중간

| ID | 이슈 | 근거 | 권장 조치 | 상태 |
|----|------|------|-----------|------|
| M1 | 공개 calendar `start` 누락 시 HTTP 500 | `MissingServletRequestParameterException` | 400 + 명확한 메시지 | 미조치 |
| M2 | 단순 날짜 `start=YYYY-MM-DD` 는 파싱 실패 후 빈 배열 | `OffsetDateTime.parse`만 허용, 실패 시 빈 목록 | `LocalDate` 허용 또는 400 반환 (프론트는 ISO라 UI는 정상) | 미조치 |
| M3 | 사이드바 메뉴 불완전·복제 | 일부 페이지에서 상품/결제/시설/설정 섹션 누락 | 공통 사이드바 템플릿화 | 미조치 |
| M4 | `baseball-records.html` 메뉴 미연결 | URL 직접 접근만 가능 | 사이드바/권한 메뉴에 추가 또는 폐기 | 미조치 |
| M5 | XSS `escapeHtml` 불균일 | `users.js`, `rankings.js`, `training-logs.js`, `baseball-records.js` 등 | `App.escapeHtml` 일괄 적용 | 미조치 |
| M6 | 기동 시 `DatabaseMigration` 데이터 보정 | PENDING→CONFIRMED, 이용권/결제 보정 등 | 운영 프로파일에서 위험 보정 분리·플래그화 | 미조치 |

### 5.3 낮음

| ID | 이슈 | 권장 조치 | 상태 |
|----|------|-----------|------|
| L1 | 테스트 `AfbsCenterApplicationTests`만 존재 | 인증·예약 필터·공개 API 스모크 테스트 추가 | 미조치 |
| L2 | `js/bookings-yeonsan.js` 고아 파일 | 삭제 또는 README에 “미사용” 명시 | 미조치 |
| L3 | `App.debug` 기본 `true` | 운영 기본 `false` | 미조치 |
| L4 | `/api/bookings/rentals` 호출 시 500 | `/{id}`에 `"rentals"` 매칭. **실사용 경로 아님** (`/stats/rentals`, `?branch=RENTAL` 사용) | 보류(문서화만) |

---

## 6. 구조·기능 맵 (점검 시점)

### 6.1 백엔드 (요약)

- 컨트롤러 ~40개, `/api/members`·`/api/bookings` 등은 역할별 컨트롤러 분리
- 인증: 커스텀 `JwtFilter` (`SecurityFilterChain` 기반 인가 아님)
- 공개: `/api/auth/login|register|validate|init-admin`, `/api/public/**`, 랭킹 GET 일부
- 최근 축: 코치 고유색, 회원 승인(`member-approvals`), 공개 회원예약, 회비 합성 공지

### 6.2 프론트 (요약)

- 페이지별 HTML + JS, 공통 `common.js` / `common.css`
- 예약 6종 HTML → 공통 `bookings.js` + `BOOKING_PAGE_CONFIG`
- 공개 예약: `member-booking.html` → `/api/public/member-booking`

---

## 7. 재현·재점검 커맨드 (참고)

```powershell
# 빌드
cd C:\Users\seo\Desktop\afbscenter
mvn -q compile -DskipTests

# 로그인 후 토큰
$base = 'http://localhost:8080'
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
$h = @{ Authorization = "Bearer $($login.token)" }

# 대시보드
Invoke-WebRequest "$base/api/dashboard/kpi" -Headers $h -UseBasicParsing

# 예약 (ISO 기간 — 프론트와 동일)
$start = [uri]::EscapeDataString('2026-08-01T00:00:00.000Z')
$end   = [uri]::EscapeDataString('2026-08-31T23:59:59.999Z')
Invoke-WebRequest "$base/api/bookings?start=$start&end=$end" -Headers $h -UseBasicParsing
```

> 비밀번호·시크릿은 문서/저장소에 평문으로 남기지 말 것. 로컬 기본값은 `application.properties`의 `admin.init.password` / 환경변수 참고.

---

## 8. 다음 권장 작업 순서

1. **H1** 이용권 미연결 예약 Admin 체크 수정 (즉시, 범위 작음)
2. **H2** 예약/출석 무필터 조회 제한 또는 기본 기간
3. **M1** 공개 calendar 파라미터 오류를 400으로
4. **H4/H5** 운영 배포 전 시크릿·RBAC 점검
5. **M3/M5** 사이드바 통일, XSS 보강
6. **L1** API 스모크 테스트 자동화

---

## 9. 변경 이력

| 날짜 | 작성 | 내용 |
|------|------|------|
| 2026-09-04 | 기능 점검 | 최초 작성 (컴파일·기동 서버 스모크·이슈 분류) |
