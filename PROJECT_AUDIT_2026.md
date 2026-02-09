# 프로젝트 전체 점검 보고서 (2026년 2월)

## 📋 개요

- **프로젝트**: AFBS Center (스포츠 운영 센터)
- **스택**: Spring Boot 3.2, Java 17, H2, JPA, 정적 HTML/JS/CSS
- **점검일**: 2026년 2월

---

## ✅ 점검 결과 요약

| 영역 | 상태 | 비고 |
|------|------|------|
| 인증/인가 | ✅ 구현됨 | JWT + 로그인, 역할별 메뉴 |
| 보안 설정 | ✅ 개선 반영 | API·로그에서 비밀번호 노출 제거 |
| CORS | ✅ 설정됨 | application.properties로 origin 관리 |
| 예외 처리 | ✅ 양호 | GlobalExceptionHandler, 401 시 알림 후 로그인 자동 이동 |
| DB/쿼리 | ✅ 안전 | Native SQL 미사용, JPA만 사용 |
| XSS 대응 | ✅ 사용 | App.escapeHtml 다수 사용 |
| 설정 분리 | ✅ 적용 | prod에서 show-sql=false, ddl-auto=validate |

---

## 🔧 이번 점검에서 적용한 수정·개선

| 구분 | 내용 |
|------|------|
| 보안 | **AuthService**: 관리자 계정 생성/재설정 API 응답에서 실제 비밀번호 제거. "초기 비밀번호는 설정값을 확인하세요" 문구로 변경. |
| 보안 | **DatabaseMigration**: 관리자 계정 생성 시 로그에 비밀번호 출력하지 않도록 수정. |
| UX | **common.js**: `App.handle401()` 추가. API 401 시 토큰 제거 → 알림("로그인 세션이 만료되었습니다") → 0.6초 후 로그인 페이지 이동. get/post/put/delete 공통 적용. |
| 코드 | **MemberController**: 미사용 import 제거 (`MemberResponseDTO`, `Propagation`). |

---

## 🔒 보안 (운영 시 권장 사항)

1. **JWT 시크릿**: 환경변수 `JWT_SECRET` 사용 (32자 이상 권장).
2. **관리자 초기 비밀번호**: `ADMIN_INIT_PASSWORD` 환경변수로 설정, 배포 후 조기 변경.
3. **H2 콘솔**: 운영에서 `spring.h2.console.enabled=false` 또는 접근 제한.
4. **CORS**: `cors.allowed-origins`에 실제 서비스 도메인만 등록.

---

## 🏗 아키텍처·구조

### 백엔드

- **컨트롤러**: 회원, 예약, 결제, 대시보드, 분석, 설정 등 역할별 분리.
- **인증**: `JwtFilter`에서 `/api/*` 검증, 로그인/회원가입/validate/init-admin 제외.
- **예외**: `GlobalExceptionHandler`에서 Validation, NPE, NumberFormat, HttpMessageNotReadable 등 처리.
- **DB**: H2 file 모드, UTF-8, `ddl-auto=update`(dev) / `validate`(prod).

### 프론트엔드

- **공통**: `common.js` — API 베이스(`/api`), 인증 헤더, 401 시 `App.handle401()`로 알림·로그인 페이지 이동.
- **인증**: 미인증 시 `login.html` 리다이렉트.
- **출력**: 사용자 입력 표시 시 `App.escapeHtml()` 사용.

### 정적 리소스

- HTML: index, members, bookings(사하/연산/트레이닝), rentals, attendance, coaches, training-logs, rankings, training-stats, products, payments, facilities, analytics, announcements, settings, users, permissions 등.
- JS: 페이지별 분리 + `common.js` 공통.

---

## 📁 설정

### application.properties

- `spring.profiles.active=dev` (로컬 기본).
- DB: `./data/afbscenter`, 사용자 `sa`, 비밀번호 빈값 (로컬).
- JWT·관리자 초기 비밀번호: 기본값 있음, 운영 시 환경변수 권장.

### .gitignore

- `application-dev.properties`, `application-local.properties` 제외.
- `data/`, `*.db`, `*.mv.db`, `*.sql` 제외.

---

## ⚠️ 참고 (추가 개선 권장)

1. **로깅**: dev의 `logging.level.com.afbscenter=DEBUG` — 운영은 application-prod 기준 INFO 사용 권장.
2. **의존성**: Spring Boot 3.2.0, POI 5.2.5 등 정기 버전·CVE 점검 권장.

---

## 📊 기능별 상태 (요약)

- 대시보드, 회원, 예약(사하/연산/트레이닝), 대관, 출석, 코치, 훈련기록/랭킹/통계, 상품, 결제, 시설, 분석, 공지, 설정, 사용자/권한 관리 등 주요 기능 구현·동작 확인.
- 상세 목록은 [docs/PROJECT_AUDIT_REPORT.md](docs/PROJECT_AUDIT_REPORT.md) 참고.

---

## ✅ 결론

- 인증·인가, CORS, 예외 처리, XSS 대응, DB 사용 방식은 적절히 구성되어 있음.
- 이번 점검에서 API·로그 비밀번호 노출 제거, 401 공통 처리, 코드 정리 반영 완료.
- 운영 배포 시 JWT 시크릿·관리자 비밀번호·CORS·H2 콘솔·로깅은 위 권장 사항 적용 권장.
