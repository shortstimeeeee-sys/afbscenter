# AFBS Center 기능 점검 보고서 (이 PC)

| 항목 | 내용 |
|------|------|
| 프로젝트 | AFBS Center (스포츠 운영 센터) |
| 경로 | `C:\Users\Home\afbscenter` |
| 점검일 | 2026-09-05 |
| 점검 범위 | 이 PC 환경 확인 + 전체 구조 리뷰 + 기동 서버 스모크 + 브라우저 화면 확인 + 복사 DB 검증 |
| 스택 | Spring Boot 3.2.0, Java 17.0.15 (Temurin), Maven 3.9.10, H2, JPA, 정적 HTML/JS/CSS |
| 테스트 | `mvn test` → **성공** (`AfbsCenterApplicationTests`, in-memory H2) |
| 서버 | `http://localhost:8080` (점검 시점 기동 중, Java PID 3140, 18:40 기동) |

관련 문서: [PROJECT_AUDIT_2026-09-04.md](PROJECT_AUDIT_2026-09-04.md) (전날 기능 점검), [PROJECT_REVIEW_FULL.md](PROJECT_REVIEW_FULL.md), [SYNC_노트북_데스크탑.md](SYNC_노트북_데스크탑.md)

---

## 1. 종합 판정

**이 PC에서 일상 운영이 가능하다.** Git으로 받은 코드와 USB/복사로 가져온 H2 DB가 맞물려, 로그인·대시보드·회원·예약이 **실제 운영 데이터**로 동작한다.

다만 전날(9/4)과 같이 **이용권 미연결 예약 Admin 체크 버그**, **예약 무필터 대용량 조회**, **공개 API·시크릿 기본값**은 그대로다. 오늘은 브라우저에서 Admin으로 로그인했음에도 이용권 미연결 화면이 차단되는 것을 **재현**했다.

| 영역 | 상태 | 요약 |
|------|------|------|
| 이 PC 환경 | ✅ | Java 17 / Maven 3.9.10 / PATH 일치 |
| 빌드·테스트 | ✅ | `mvn test` 성공 |
| 기동 | ✅ | localhost:8080 HTTP 200 |
| DB 이전 | ✅ | 회원 185, 예약 3644, 오늘(9/5) 예약·출석 포함 |
| 정적 페이지 | ✅ | 점검한 HTML 23개 HTTP 200 |
| 인증(JWT) | ✅ | 로그인·`/api/auth/me` 정상, 미인증 보호 API 401 |
| 대시보드 | ✅ | KPI·알림·오늘 일정·공지 API·화면 정상 |
| 회원/코치/상품/결제 | ✅ | 목록·핵심 조회 API 정상 |
| 예약(필터 있음) | ✅ | `date=` 또는 ISO `start`/`end` 정상. 사하 야구 9월 UI 55건 |
| 코치 고유색 | ✅ | 활성 코치 12명, 색 중복 없음 |
| 이용권 미연결 예약 UI | ❌ | Admin 세션인데도 차단 화면 (H1 재현) |
| 성능(무필터 예약) | ⚠️ | `/api/bookings` 무파라미터 약 6.5초 / 2.7MB |
| 보안(외부 공개 준비) | ⚠️ | 공개 회원번호 API, JWT/초기비번 기본값 |
| 자동화 테스트 | ⚠️ | `contextLoads` 1건만 존재 |

로컬(이 PC만) 사용이면 운영에 지장 없다. 인터넷/ngrok 노출 전에는 시크릿·RBAC를 손보는 것이 좋다.

---

## 2. 점검 방법

1. 소스 구조(컨트롤러·서비스·정적 리소스) 파일 수 집계
2. `mvn test`
3. 기동 서버에 대해 페이지 GET + 로그인 후 주요 REST 호출(지연·응답 크기)
4. 브라우저: `login.html` → admin 로그인 → 대시보드 → 회원 → 사하 야구 예약 → 이용권 미연결 예약
5. H2 파일에서 최근 회원·예약·결제·출석 시각 조회 (복사 DB 검증)

비밀번호·JWT 시크릿은 이 문서에 적지 않는다. 로컬 기본값은 `src/main/resources/application.properties`의 `admin.init.password` / `jwt.secret` 또는 환경변수.

---

## 3. 이 PC 환경

| 항목 | 값 |
|------|-----|
| Java | Eclipse Temurin 17.0.15 (`JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.0.15.6-hotspot`) |
| Maven | 3.9.10 (`C:\apache-maven-3.9.10`) |
| Git | 2.50.0 (`C:\Program Files\Git\cmd`, 사용자 PATH에 추가함) |
| 프로젝트 | `git clone https://github.com/shortstimeeeee-sys/afbscenter.git` → `C:\Users\Home\afbscenter` |
| 제어판 | 바탕화면 `Server Control Panel.lnk` (`create-desktop-shortcut.ps1`로 생성) |
| DB 파일 | `data\afbscenter.mv.db` (Git에 없음. 다른 PC에서 `data` 폴더 복사) |

참고: `java -version`이 21로 나오던 때는 PATH의 Oracle `javapath`가 17보다 앞이었음. 점검은 Java 17로 맞춘 뒤 수행.

---

## 4. 복사 DB 검증

서버가 사용하는 H2 (`jdbc:h2:file:./data/afbscenter`) 기준.

| 테이블 | 건수 |
|--------|------|
| members | 185 |
| bookings | 3644 |
| payments | 451 |
| attendances | 3103 |
| member_products | 466 |
| coaches | 17 |
| products | 31 |
| facilities | 2 |
| users | 6 |

| 구분 | 가장 최근 |
|------|-----------|
| 예약 등록(`created_at`) | **2026-09-05 17:59** (레슨) |
| 출석 체크인 | **2026-09-05 10:00** |
| 회원 등록 | 2026-09-03 이건희 |
| 결제(`paid_at`) | 2026-09-03 |

빈 DB가 아니라 원래 PC의 운영 데이터가 온 것으로 판단.

계정 예: `admin`(ADMIN), 서정훈(COACH), xorhko12(ADMIN) 등 6개. (비밀번호는 문서화하지 않음)

---

## 5. 구조 요약 (점검 시점)

| 레이어 | 개수 |
|--------|------|
| 컨트롤러 | 41 |
| 서비스 | 11 |
| Repository | 23 |
| 엔티티 | 24 |
| 정적 HTML | 28 |
| JS | 22 |

인증은 커스텀 `JwtFilter` (`/api/*` JWT, login/register/validate/init-admin·`/api/public/` 제외). Spring Security 인가 체인이 아니라 **토큰 유효성** 위주다.

프론트는 페이지별 HTML + JS, 공통 `js/common.js`.

---

## 6. 통과한 기능 체크리스트

### 6.1 정적 페이지 (HTTP 200)

| 페이지 | 코드 | 지연(대략) |
|--------|------|------------|
| `/` | 200 | 99ms |
| `/login.html` | 200 | 42ms |
| `/members.html` | 200 | 56ms |
| `/coaches.html` | 200 | 25ms |
| `/bookings.html` | 200 | 45ms |
| `/bookings-yeonsan.html` | 200 | 47ms |
| `/bookings-saha-youth.html` | 200 | 40ms |
| `/bookings-without-product.html` | 200 | 33ms (HTML만. UI 권한은 §8 H1) |
| `/attendance.html` | 200 | 34ms |
| `/payments.html` | 200 | 39ms |
| `/products.html` | 200 | 31ms |
| `/rentals.html` | 200 | 74ms |
| `/facilities.html` | 200 | 24ms |
| `/analytics.html` | 200 | 35ms |
| `/announcements.html` | 200 | 141ms |
| `/settings.html` | 200 | 33ms |
| `/users.html` | 200 | 33ms |
| `/member-booking.html` | 200 | 59ms |
| `/rankings.html` | 200 | 29ms |
| `/training-logs.html` | 200 | 36ms |
| `/baseball-records.html` | 200 | 32ms |
| `/permissions.html` | 200 | 35ms |
| `/training-stats.html` | 200 | 36ms |

### 6.2 인증

| 항목 | 결과 | 비고 |
|------|------|------|
| `POST /api/auth/login` | ✅ | 약 299ms, role=ADMIN, 토큰 발급 |
| `GET /api/auth/me` (Bearer) | ✅ | 31ms |
| 보호 API 무토큰 | ✅ | `/api/members`, `/users`, `/settings`, `/db-status`, `/coaches`, `/dashboard/kpi` → **401** |
| 브라우저 로그인 | ✅ | `login.html` → `/` 대시보드 (제목: 대시보드 - AFBS 센터) |

### 6.3 대시보드 API

| API | 코드 | 지연 | 크기 |
|-----|------|------|------|
| `GET /api/dashboard/kpi` | 200 | 192ms | 432B |
| `GET /api/dashboard/alerts` | 200 | 22ms | 5.7KB |
| `GET /api/dashboard/today-schedule` | 200 | 169ms | 6.8KB |
| `GET /api/dashboard/announcements` | 200 | 45ms | 384B |
| `GET /api/dashboard/expiring-members` | 200 | 249ms | 18KB |
| `GET /api/dashboard/revenue-metrics` | 200 | 26ms | 371B |

브라우저 대시보드: 공지·오늘 일정·알림 배지(2) 표시. 일부 위젯은 스냅샷 직후 “로딩 중…”이 잠깐 보였다가 API 완료 후 채워지는 형태.

### 6.4 핵심 업무 API

| API | 코드 | 지연 | 비고 |
|-----|------|------|------|
| `GET /api/coaches`, `/api/coaches/active` | 200 | ~20ms | 활성 12명, 색 12종 중복 없음 |
| `GET /api/members` | 200 | 678ms | 232KB |
| `GET /api/products` | 200 | 26ms | |
| `GET /api/payments` | 200 | 23ms | |
| `GET /api/facilities` | 200 | 21ms | |
| `GET /api/announcements` | 200 | 20ms | |
| `GET /api/member-approvals/pending` | 200 | 26ms | |
| `GET /api/bookings/stats` | 200 | 28ms | |
| `GET /api/bookings/pending` | 200 | 27ms | |
| `GET /api/bookings/non-members` | 200 | 33ms | |
| `GET /api/settings` | 200 | 17ms | |
| `GET /api/users` | 200 | 20ms | |
| `GET /api/role-permissions` | 200 | 19ms | |
| `GET /api/training-logs/rankings` | 200 | 25ms | |
| `GET /api/analytics` | 200 | 186ms | |
| `GET /api/bookings/without-member-product` | 200 | 493ms | 467KB (응답은 됨. UI는 H1) |

### 6.5 예약 조회 (필터)

| 조건 | 결과 | 지연 | 크기 |
|------|------|------|------|
| `?date=2026-09-05` | ✅ | 126ms | 32KB |
| `?start=&end=` (2026-09 ISO-8601) | ✅ | 325ms | 123KB |
| 브라우저 `bookings.html` (사하 야구, 2026-09) | ✅ | — | **총 55건, 확정 50 / 대기 5**. 코치 필터(서정민, 이원준, 박근엽 등) 표시 |

### 6.6 공개 API 스모크

| 호출 | 결과 |
|------|------|
| `POST /api/public/member-booking/verify` (없는 번호) | 404 |
| `GET /api/public/member-booking/calendar` (`start` 없음) | **500** (M1) |

---

## 7. 성능 실측 (이 PC · 복사 DB)

| 호출 | 지연 | 응답 크기 | 판정 |
|------|------|-----------|------|
| 대시보드 KPI 등 | 20–250ms | 소량 | ✅ |
| `/api/bookings?date=오늘` | 126ms | 32KB | ✅ |
| `/api/bookings` 9월 ISO 기간 | 325ms | 123KB | ✅ |
| `/api/bookings` (파라미터 없음) | **6467ms** | **2.7MB** | ⚠️ |
| `/api/bookings/without-member-product` | 493ms | 467KB | ⚠️ |
| `/api/members` | 678ms | 232KB | 허용 가능 |

프론트 예약 화면은 기간 필터를 쓰므로 무필터 경로는 직접 URL/도구로 부를 때 부담이 크다.

---

## 8. 이슈 목록

상태: `미조치` / `재현` / `보류`

### 8.1 높음

| ID | 이슈 | 오늘 근거 | 권장 조치 | 상태 |
|----|------|-----------|-----------|------|
| H1 | `bookings-without-product.html`이 `restoreAuth` 전에 `App.currentRole`을 읽어 Admin도 차단 | 브라우저에서 admin 로그인 후 해당 페이지 → “관리자만 이용할 수 있습니다.” | `DOMContentLoaded` + `restoreAuth` 이후 역할 검사 | **재현** |
| H2 | 예약 무필터 전체 조회 | 6.5초 / 2.7MB | 기본 기간 강제, 페이징, 또는 무필터 400 | 미조치 |
| H3 | 공개 API가 회원번호만으로 접근 | `/api/public/member-booking/**` | OTP/전화 끝자리 등, 응답 필드 최소화 | 미조치 |
| H4 | JWT·관리자 초기 비밀번호 기본값 | `application.properties` | 운영에서 `JWT_SECRET`, `ADMIN_INIT_PASSWORD` 필수 | 미조치 |
| H5 | API 역할 검사가 불균일 (유효 JWT면 다수 관리 API) | `JwtFilter`는 토큰 유효성 위주 | 민감 엔드포인트에 역할 검사 | 미조치 |

### 8.2 중간

| ID | 이슈 | 오늘 근거 | 권장 | 상태 |
|----|------|-----------|------|------|
| M1 | 공개 calendar `start` 누락 시 HTTP 500 | 재현 | 400 + 메시지 | 재현 |
| M2 | 단순 날짜 `start=YYYY-MM-DD` 파싱 실패 시 빈 배열 | 9/4와 동일 구조 | LocalDate 허용 또는 400 | 미조치 |
| M3 | 사이드바 메뉴 복제 | HTML마다 메뉴 반복 | 공통 템플릿 | 미조치 |
| M4 | `baseball-records.html` 메뉴 연결 약함 | 페이지는 200 | 메뉴 추가 또는 폐기 | 미조치 |
| M5 | `escapeHtml` 불균일 | 9/4와 동일 | `App.escapeHtml` 일괄 | 미조치 |
| M6 | 기동 시 `DatabaseMigration` 보정 | 테스트 로그에 H2에서 MySQL식 JOIN UPDATE 문법 경고 | 운영 프로파일에서 위험 보정 분리 | 미조치 |

### 8.3 낮음

| ID | 이슈 | 권장 | 상태 |
|----|------|------|------|
| L1 | 테스트 1건만 | 인증·예약 필터·공개 API 스모크 추가 | 미조치 |
| L2 | `js/bookings-yeonsan.js` 고아 가능 | 삭제 또는 미사용 명시 | 미조치 |
| L3 | `App.debug` 기본 true | 운영 기본 false | 미조치 |

---

## 9. 권장 작업 순서

1. **H1** 이용권 미연결 예약 Admin 체크 시점 수정 (오늘 재현, 범위 작음)
2. **H2** 예약 무필터 조회 제한
3. **M1** 공개 calendar 파라미터 오류를 400으로
4. 외부 공개(ngrok 등) 전이면 **H4/H5** 시크릿·역할 검사
5. **L1** API 스모크 테스트 자동화

---

## 10. 이 PC에서 다시 켜는 방법

```powershell
cd C:\Users\Home\afbscenter
.\run.ps1
```

브라우저: http://localhost:8080  
제어판: 바탕화면 **Server Control Panel**

포트 8080이 이미 쓰이면 `run.ps1`이 실패한다. 그때는 기존 서버를 쓰거나 `.\stop-server.ps1` 후 다시 실행.

DB(`data/`)는 Git에 올라가지 않는다. 다른 PC와 맞출 때는 서버를 끈 뒤 `data` 폴더를 복사한다.

---

## 11. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-09-05 | 이 PC(`C:\Users\Home\afbscenter`) 클론·DB 복사 후 전체 점검. H1·M1 재현. |
