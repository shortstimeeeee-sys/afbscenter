# AFBS Center 프로젝트 전체 검토

**검토일**: 2026년 2월  
**범위**: 구조, 백엔드, 프론트엔드, 설정, 보안, 개선 권장 사항

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | AFBS Center (스포츠 운영 센터) |
| 스택 | Spring Boot 3.2, Java 17, H2, JPA, 정적 HTML/JS/CSS |
| 빌드 | Maven, `mvn spring-boot:run` / `run.ps1` |
| 접속 | http://localhost:8080, H2 콘솔 `/h2-console` |

---

## 2. 구조 요약

### 2.1 백엔드 패키지

- **controller**: 28개 — REST API, 역할별·기능별로 분리됨.
- **model**: 21개 — JPA 엔티티.
- **repository**: 19개 — Spring Data JPA.
- **service**: 5개 — Auth, Member, User, RolePermission, Coach, BaseballRecord.
- **config**: Cors, DatabaseMigration, DefaultsConfig, JwtFilter, SecurityConfig, WebConfig.
- **exception**: GlobalExceptionHandler (Validation, NPE, NumberFormat, DataIntegrity 등).
- **constants**: BookingDefaults, PaymentDefaults, ProductDefaults.
- **util**: JwtUtil, LessonCategoryUtil.

### 2.2 컨트롤러 분리 현황 (같은 base path 공유)

| Base path | 컨트롤러 | 역할 |
|-----------|----------|------|
| `/api/members` | MemberController | CRUD, migrate-grades, batch create-missing-payments |
| | MemberDetailController | 회원별 상세·이용권·예약·결제·출석·이력·create-missing-payments |
| | MemberQueryController | by-number, search |
| | MemberStatsController | stats |
| `/api/bookings` | BookingController | CRUD, bulk-confirm, update-lesson-categories, reorder |
| | BookingStatsController | stats, pending, non-members, rentals, without-member-product |
| `/api/products` | ProductController | CRUD |
| | ProductAdminController | batch-update-monthly-pass-conditions, batch-update-all, fix-data-integrity |
| `/api/payments` | PaymentController | CRUD, refund, reorder |
| | PaymentStatsController | summary, statistics/method, unpaid/details, export/excel |
| `/api/attendance` | AttendanceController | CRUD, checkin, checkout |
| | AttendanceQueryController | checked-in, unchecked-bookings |
| `/api/training-logs` | TrainingLogController | CRUD |
| | TrainingLogStatsController | unregistered-count, rankings |
| `/api/member-products` | MemberProductController | CRUD, recalculate |
| | MemberProductStatsController | statistics |

분리 규칙이 일관되고, URL·시그니처가 유지되어 프론트 수정 없이 동작함.

### 2.3 대형 파일 (라인 수 기준, 참고)

| 파일 | 라인 수 | 비고 |
|------|--------|------|
| BookingController.java | ~2,068 | 예약·대관·레슨 등 통합, 여전히 큼 |
| AnalyticsController.java | ~1,920 | 대시/분석용 API 다수 |
| MemberDetailController.java | ~1,761 | 회원 상세·서브리소스 |
| AttendanceController.java | ~1,286 | 출석 CRUD·체크인/아웃 |
| MemberService.java | ~1,234 | 회원 비즈니스·DTO 변환 |
| MemberController.java | ~1,181 | 회원 CRUD·배치 |
| MemberProductController.java | ~1,127 | 이용권 CRUD·재계산 |
| DashboardController.java | ~1,067 | 대시보드 API |
| DatabaseMigration.java | ~877 | 앱 기동 시 마이그레이션 |

이전 검토 대비 Member/Booking 일부가 분리되어 줄었으나, 여전히 1,000줄 이상 파일이 많음. 점진적 분리 여지 있음.

### 2.4 프론트엔드

- **HTML**: 30개 이상 (index, members, bookings 시리즈, rentals, attendance, products, payments, analytics 등).
- **JS**: 페이지별 분리 + `common.js` (API 베이스, 인증, 401 처리, escapeHtml 등).
- **CSS**: 페이지별 + `common.css`.
- 번들러 없음 → 페이지별 스크립트만 로드되어 체감 부하는 제한적.
- **XSS 대응**: `App.escapeHtml` 사용이 여러 JS에서 확인됨 (common, members, bookings, payments 등).

---

## 3. 설정·환경

### 3.1 application.properties

- 기본: `spring.profiles.active=dev`
- DB: H2 file `./data/afbscenter`, UTF-8, `ddl-auto=update` (dev).
- JWT: `jwt.secret`, `jwt.expiration` — 기본값 있음, 운영 시 `JWT_SECRET` 환경변수 권장.
- 관리자 초기 비밀번호: `admin.init.password` — 운영 시 `ADMIN_INIT_PASSWORD` 권장.
- CORS: `cors.allowed-origins`로 origin 관리.
- Settings·Product·Payment·Facility 등 기본값이 properties에 정리됨.

### 3.2 프로파일

- **application.properties**: 공통 + dev 기본.
- **application-dev.properties**: 개발용 (존재).
- **application-prod.properties**: `ddl-auto=validate`, `show-sql=false`, H2 콘솔 비활성화, `DB_PASSWORD`, `ALLOWED_ORIGINS` 등 — 운영 대비 양호.

---

## 4. 보안·인증

| 항목 | 상태 | 비고 |
|------|------|------|
| JWT | ✅ | JwtFilter에서 `/api/*` 검증, login/register/validate/init-admin 제외 |
| 비밀번호 | ✅ | BCrypt, API·로그에 평문 비밀번호 노출 제거됨 (PROJECT_AUDIT_2026 반영) |
| 401 처리 | ✅ | common.js `App.handle401()` — 토큰 제거 후 알림·로그인 페이지 이동 |
| CORS | ✅ | properties로 origin 제한 |
| GlobalExceptionHandler | ✅ | Validation, NPE, NumberFormat, HttpMessageNotReadable, DataIntegrity, ConstraintViolation, NoResourceFound, Exception 처리 |

운영 시 권장: `JWT_SECRET`(32자 이상), `ADMIN_INIT_PASSWORD` 변경, H2 콘솔 비활성화, `cors.allowed-origins` 실제 도메인만.

---

## 5. 강점

1. **패키지 구조**: controller / service / repository / model / config / exception 역할이 분명함.
2. **API 분리**: 같은 base path下에서 통계·조회·관리 API가 별도 컨트롤러로 나뉘어 가독성·유지보수에 유리함.
3. **설정 분리**: dev/prod 프로파일, 기본값·시크릿을 properties/환경변수로 관리.
4. **예외 처리**: 전역 핸들러로 일관된 에러 응답.
5. **문서**: README, QUICK_START, SETUP_GUIDE, DEPLOYMENT_GUIDE, PROJECT_AUDIT_2026, PROJECT_REVIEW_2026, docs/ 정리.

---

## 6. 개선 권장 사항

### 6.1 높은 우선순위

| 항목 | 내용 | 비고 |
|------|------|------|
| **테스트 부재** | `src/test` 디렉터리가 없음. 핵심 API·AuthService·MemberService 등에 단위/통합 테스트를 도입하면 리팩터링·배포 안정성에 도움이 됨. | ✅ **반영**: `AfbsCenterApplicationTests`(컨텍스트 로드) + 테스트 전용 `application.properties`(in-memory H2) 추가. 프로덕션 코드 변경 없음. |
| **README 프로젝트 구조** | README의 controller 목록이 구버전(예: MemberController, BookingController, ProductController만 기재). MemberDetailController, ProductAdminController, BookingStatsController 등 분리된 컨트롤러 반영 시 신규 참여자 이해에 유리함. | ✅ **반영**: README controller 목록 갱신, PROJECT_REVIEW_FULL 링크 추가 완료. |

### 6.2 중간 우선순위 (여유 있을 때)

| 항목 | 내용 | 비고 |
|------|------|------|
| **대형 컨트롤러** | BookingController(2k+), AnalyticsController(1.9k), MemberDetailController(1.7k), AttendanceController(1.2k) 등은 기능 단위로 더 쪼개면 가독성·단일 책임에 유리함. (기능 동일 유지한 채 분리하는 방향 유지.) | 기능 변경 없이 진행 가능 시 점진 적용 권장. |
| **서비스 계층** | 일부 컨트롤러가 repository를 직접 많이 사용. 공통 비즈니스 로직을 service로 이전하면 테스트·재사용에 유리함. | 리팩터링 범위 커서 별도 검토. |
| **DTO 일원화** | 요청/응답에 Map<String, Object> 사용이 많음. 주요 API에 요청·응답 DTO 클래스를 두면 타입 안정성·문서화에 도움이 됨. | 프론트 연동 검증 필요. |

### 6.3 낮은 우선순위

| 항목 | 내용 | 비고 |
|------|------|------|
| **HTML 메뉴 중복** | 여러 HTML에 동일 사이드바·메뉴 반복. iframe/SSI/빌드 시 조각 삽입 등으로 한 곳에서 관리하면 메뉴 변경 시 수정이 쉬움. (현 구조로도 동작에는 문제 없음.) | — |
| **의존성 버전** | Spring Boot 3.2.0, POI 5.2.5, jjwt 0.12.3 등 주기적 CVE·호환성 점검 권장. | — |
| **로깅** | dev의 `logging.level.com.afbscenter=DEBUG` — prod는 application-prod 기준 INFO로 유지 권장. | ✅ **이미 적용**: application-prod.properties에 `logging.level.com.afbscenter=INFO` 설정됨. |

---

## 6.4 반영한 개선 (기능 변경 없음)

| 항목 | 조치 |
|------|------|
| **테스트 도입** | `src/test/java/com/afbscenter/AfbsCenterApplicationTests.java` — `@SpringBootTest`로 컨텍스트 로드 검증. `src/test/resources/application.properties` — 테스트 전용 in-memory H2, JWT/비밀번호 테스트용 값. **프로덕션 코드 수정 없음.** |
| **README** | controller 목록을 현재 구조(분리된 컨트롤러 포함)로 갱신, PROJECT_REVIEW_FULL 링크 추가. |
| **로깅** | prod 로깅 수준은 이미 application-prod에서 INFO로 설정되어 있음 (추가 조치 없음). |

대형 컨트롤러 분리, 서비스 계층 이전, DTO 일원화, HTML 메뉴 공통화, 의존성 업그레이드는 **기능/동작 변경 가능성이 있어** 이번에는 적용하지 않음. 필요 시 점진적으로 진행 권장.

---

## 7. 요약

- **전체적으로** 구조가 역할별로 잘 나뉘어 있고, 컨트롤러 분리·설정 분리·보안(비밀번호·401·CORS)·예외 처리·XSS 대응이 적절히 갖춰져 있음.
- **당장 손댈 필수 사항**은 없고, **테스트 추가**와 **README 구조 업데이트**를 우선 추천함.
- 대형 파일·서비스 계층·DTO 정리는 점진적으로 진행해도 되는 수준임.

---

## 8. 참고 문서

- [PROJECT_AUDIT_2026.md](PROJECT_AUDIT_2026.md) — 점검 결과·보안 적용 내역
- [PROJECT_REVIEW_2026.md](PROJECT_REVIEW_2026.md) — 가독성·가벼움 검토
- [docs/](docs/) — 과거 점검·리팩터링·구조 문서
