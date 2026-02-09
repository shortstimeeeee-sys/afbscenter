# 프로젝트 전체 검토 (가독성·가벼움) — 2026

## 1. 검토 범위

- **루트**: 설정·문서·스크립트
- **백엔드**: Java 소스 (config, controller, service, repository, model)
- **프론트**: HTML, JS, CSS
- **의존성**: pom.xml

---

## 2. 현재 상태 요약

### 2.1 구조

| 구분 | 상태 | 비고 |
|------|------|------|
| 패키지 구조 | ✅ 역할별 분리 | controller / service / repository / model / config / util |
| REST API | ✅ 경로 일관 | `/api/*` |
| 정적 리소스 | ✅ 페이지별 HTML·JS | 27 HTML, 20 JS, 공통 common.js·common.css |
| 설정 분리 | ✅ | application.properties, application-prod.properties |

### 2.2 파일 크기 (라인 수, 참고용)

**백엔드 (대형 파일)**

| 파일 | 라인 수 | 비고 |
|------|--------|------|
| MemberController.java | ~3,100 | 한 파일에 API·로직 많음 |
| BookingController.java | ~2,600 | 예약·대관·비회원 등 통합 |
| DatabaseMigration.java | ~890 | 마이그레이션 단계 많음 |
| MemberService.java | 대형 가능 | 필터·DTO 변환 등 |

**프론트 (대형 파일)**

| 파일 | 라인 수 | 비고 |
|------|--------|------|
| bookings.js | ~4,300 | 사하 예약 + 모달·캘린더·목록 |
| members.js | ~4,000 | 회원 CRUD·통계·모달 |
| rentals.js | ~3,700 | 대관 전용 |
| dashboard.js | ~3,200 | 대시보드·KPI·모달 |
| common.js | ~2,500 | API·인증·공통 UI |

**가독성:** 위 파일들은 기능이 많아 한 번에 읽기 부담될 수 있음.  
**가벼움:** 번들러 없이 페이지별 스크립트 로드라, 실제로는 해당 페이지만 로드되는 JS만 내려받음 → 체감 부하는 제한적.

### 2.3 의존성 (pom.xml)

- Spring Boot Web, Data JPA, Validation, H2, Lombok, DevTools, Test  
- POI (Excel), JWT(jjwt), spring-security-crypto  
- **평가:** 필수 위주, 과한 의존 없음. POI·JWT 버전만 주기적 점검 권장.

### 2.4 HTML·메뉴

- **27개 HTML** 각각에 **사이드바·메뉴가 거의 동일**하게 반복됨.  
- 메뉴 변경 시 여러 파일 수정 필요.  
- **가독성:** 구조는 단순하나, 메뉴 수정 시 일관성 유지가 번거로울 수 있음.

### 2.5 문서·스크립트 (루트)

- **문서:** 루트에는 README, QUICK_START, SETUP_GUIDE, DEPLOYMENT_GUIDE, PROJECT_AUDIT_2026, PROJECT_REVIEW_2026. 과거 점검·리팩터링 문서는 docs/에 정리됨.  
- **스크립트:** server-control-panel(*), run(*), start-ngrok(*), fix-maven(*), create-maven-settings 등  
- **가독성:** 문서가 여러 개로 나뉘어 있어, “처음 보는 사람” 입장에서는 README에서 진입 경로(처음 실행 → QUICK_START, 기타 → docs/) 안내로 정리됨.

---

## 3. 가독성·가벼움 체크리스트

| 항목 | 결과 | 설명 |
|------|------|------|
| 프로젝트 구조 | ✅ | 패키지·리소스 역할이 분명함 |
| 네이밍 일관성 | ✅ | controller/service/repository 명명 일관 |
| 설정 분리 (dev/prod) | ✅ | 프로파일·환경 분리 적용 |
| 의존성 수 | ✅ | 꼭 필요한 수준, 가벼운 편 |
| 번들 크기 | ✅ | 프론트 번들 없음, 페이지별 로드 |
| 대형 단일 파일 | ⚠️ | Member/Booking 컨트롤러·JS 일부 3k~4k 라인 |
| HTML 메뉴 중복 | ⚠️ | 27개 페이지에 동일 메뉴 반복 |
| 문서 개수 | ⚠️ | MD·가이드 다수, 진입점 정리 시 가독성 향상 |

---

## 4. 결론: “가독성 있고 가볍게 갈 수 있는지”

- **전체적으로는 “가볍고 정리된 상태”로 볼 수 있음.**  
  - 의존성 적당, 빌드·실행 단순, 페이지별 로드로 불필요한 무거운 번들은 없음.  
- **가독성**은 “구조는 좋고, 일부 파일만 크다” 수준.  
  - 큰 파일(MemberController, BookingController, members.js, bookings.js 등)을 나중에 기능 단위로 나누면 더 읽기 쉬워짐.  
- **지금 당장 필수로 손댈 부분은 없고**,  
  - “점진적으로 큰 파일만 분리 + 문서는 README/QUICK_START 중심으로 정리”만 해도 가독성·가벼움 유지에 충분함.

---

## 5. 적용한 정리 (기능 영향 없음)

- **문서 정리**: 과거 점검·리팩터링 문서 8개를 `docs/`로 이동. 루트에는 README, QUICK_START, SETUP_GUIDE, DEPLOYMENT_GUIDE, PROJECT_AUDIT_2026, PROJECT_REVIEW_2026 유지. README에 문서 진입 안내 추가.

## 6. 권장 개선 (우선순위 낮음, 여유 있을 때)

1. **대형 컨트롤러 분리**  
   - MemberController → 예: MemberQueryController, MemberCommandController 등 역할별로 분리 검토.  
   - BookingController → 예: BookingReadController, BookingWriteController, RentalController 등으로 분리 검토.

2. **대형 JS 분리**  
   - members.js / bookings.js 를 “모달”, “테이블”, “캘린더” 등 기능별 모듈로 나누고, 기존 한 파일에서 여러 스크립트 로드하도록 변경.

3. **문서 정리**  
   - README에 “처음 읽을 문서: README → QUICK_START → (배포는 DEPLOYMENT_GUIDE)” 식으로 한 줄 안내 추가.  
   - 오래된 감사/리팩터링 문서는 `docs/` 등 한 폴더로 모아두면 루트가 정리됨.

4. **메뉴 공통화 (선택)**  
   - iframe/SSI/빌드 시 조각 삽입 등으로 메뉴 HTML을 한 곳에서 관리하면, 메뉴 변경 시 한 번만 수정 가능. (현 구조 유지해도 동작에는 문제 없음.)

---

## 7. 한 줄 요약

- **구조·의존성·로딩 방식**은 이미 가독성 있고 가볍게 유지 가능한 상태이며,  
- **일부 대형 파일**과 **문서/메뉴 중복**만 단계적으로 정리하면 더 유지보수하기 좋아진다.
