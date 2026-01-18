# 프로젝트 전체 검토 보고서

**작성일**: 2026-01-15  
**프로젝트**: AFBS Center  
**검토 범위**: 전체 프로젝트 구조 및 코드 품질

---

## 📊 현재 상태 요약

### ✅ 긍정적인 부분
1. **컴파일 성공**: 모든 코드가 정상적으로 컴파일됨
2. **기본 구조**: Spring Boot 표준 아키텍처 (Controller-Service-Repository) 사용
3. **예외 처리**: GlobalExceptionHandler로 전역 예외 처리 구현
4. **로깅**: SLF4J를 통한 일관된 로깅

### ⚠️ 발견된 주요 문제점

---

## 🔴 심각한 문제 (즉시 개선 필요)

### 1. MemberGrade Enum 변환 문제로 인한 복잡한 Fallback 로직

**문제점:**
- `MemberGrade` enum이 `REGULAR/PLAYER` → `SOCIAL/ELITE/YOUTH`로 변경되면서 기존 DB 데이터와 불일치
- 이를 해결하기 위해 **과도한 fallback 로직**이 여러 컨트롤러에 추가됨
- 코드 복잡도가 크게 증가

**영향을 받는 파일:**
- `BookingController.java` - 1700+ 라인 (너무 큼)
- `MemberController.java`
- `DashboardController.java`
- `AnalyticsController.java`
- `AttendanceController.java`
- `TrainingLogController.java`

**현재 패턴:**
```java
// 거의 모든 컨트롤러에서 반복되는 패턴
try {
    memberService.migrateMemberGradesInSeparateTransaction();
} catch (Exception e) {
    logger.debug("마이그레이션 실행 중 오류 (무시): {}", e.getMessage());
}

try {
    // JPA 조회
    bookings = bookingRepository.findAllWithFacilityAndMember();
} catch (Exception e) {
    // JdbcTemplate fallback
    bookings = jdbcTemplate.query(...);
}

// Member 정보 읽기 시 또 try-catch
try {
    if (booking.getMember() != null) {
        // ...
    } else {
        // 별도로 member_id 조회 후 Member 정보 조회
    }
} catch (Exception e) {
    // ...
}
```

**문제:**
1. **중복 코드**: 동일한 패턴이 6개 이상의 컨트롤러에 반복
2. **성능 저하**: 매 요청마다 마이그레이션 체크 및 fallback 로직 실행
3. **유지보수 어려움**: 로직이 분산되어 있어 수정 시 여러 파일 수정 필요
4. **가독성 저하**: 핵심 비즈니스 로직이 예외 처리에 묻힘

**해결 방안:**
1. **즉시 조치**: 데이터베이스의 모든 기존 등급 값을 한 번에 마이그레이션
   ```sql
   UPDATE members SET grade = 'SOCIAL' WHERE grade = 'REGULAR';
   UPDATE members SET grade = 'ELITE' WHERE grade = 'REGULAR_MEMBER';
   UPDATE members SET grade = 'YOUTH' WHERE grade = 'PLAYER';
   ```

2. **코드 정리**: 마이그레이션이 완료되면 불필요한 fallback 로직 제거
3. **공통 유틸리티**: Member 정보 조회를 위한 공통 메서드 생성

---

### 2. 마이그레이션 로직 중복

**문제점:**
- `DatabaseMigration.java`: 애플리케이션 시작 시 자동 실행
- `MemberService.migrateMemberGradesInSeparateTransaction()`: 수동 호출
- 두 곳에 거의 동일한 로직이 중복되어 있음

**해결 방안:**
- `DatabaseMigration`에서만 마이그레이션 수행
- `MemberService`의 메서드는 `DatabaseMigration`을 호출하도록 변경
- 또는 `MemberService`의 메서드를 `DatabaseMigration`에서 호출

---

### 3. BookingController 과도한 복잡도

**문제점:**
- `BookingController.java`: **1707 라인** (너무 큼)
- 하나의 컨트롤러에 너무 많은 책임
- Member 정보 조회를 위한 복잡한 fallback 로직 포함

**해결 방안:**
1. **Service 레이어 강화**: Member 정보 조회 로직을 `BookingService`로 이동
2. **유틸리티 클래스**: Member 정보 조회를 위한 공통 유틸리티 생성
3. **메서드 분리**: 큰 메서드를 작은 메서드로 분리

---

## 🟡 중간 수준 문제 (점진적 개선)

### 4. Service 레이어 사용 불일치

**현재 상태:**
- ✅ Service 사용: `MemberController`, `CoachController`, `BaseballRecordController`
- ❌ Repository 직접 사용: `ProductController`, `FacilityController`, `AttendanceController`, `PaymentController`, `TrainingLogController`, `DashboardController`

**문제점:**
- 비즈니스 로직이 컨트롤러에 분산
- 테스트 어려움
- 코드 재사용성 저하

**해결 방안:**
- 모든 컨트롤러가 Service 레이어를 통해 Repository에 접근하도록 리팩토링
- 우선순위: 자주 사용되는 기능부터 (Booking, Payment, Attendance)

---

### 5. 과도한 Try-Catch 블록

**문제점:**
- MemberGrade enum 변환 문제로 인해 거의 모든 Member 접근에 try-catch 추가
- 예외를 조용히 무시하는 경우가 많음 (로그만 남기고 계속 진행)

**예시:**
```java
try {
    memberMap.put("grade", booking.getMember().getGrade());
} catch (Exception e) {
    logger.warn("회원 등급 읽기 실패: {}", e.getMessage());
    memberMap.put("grade", "SOCIAL"); // 기본값
}
```

**해결 방안:**
- 데이터 마이그레이션 완료 후 불필요한 try-catch 제거
- 필요한 경우에만 예외 처리 (예: 외부 API 호출, 파일 I/O)

---

### 6. JdbcTemplate과 JPA 혼용

**문제점:**
- JPA로 조회 실패 시 JdbcTemplate으로 fallback하는 패턴이 여러 곳에 반복
- 두 가지 방식이 혼용되어 일관성 부족

**해결 방안:**
- 데이터 마이그레이션 완료 후 JPA만 사용
- 필요한 경우에만 JdbcTemplate 사용 (복잡한 쿼리, 성능 최적화)

---

## 🟢 낮은 우선순위 (선택적 개선)

### 7. 코드 중복

**문제점:**
- 유사한 CRUD 패턴이 여러 컨트롤러에 반복
- Member 정보를 Map으로 변환하는 로직이 여러 곳에 중복

**해결 방안:**
- 공통 베이스 컨트롤러 또는 유틸리티 클래스 활용
- DTO 클래스 도입 고려

---

### 8. 필드 주입 vs 생성자 주입

**현재 상태:**
- 대부분 `@Autowired` 필드 주입 사용
- `MemberService`만 생성자 주입 사용

**해결 방안:**
- 모든 의존성을 생성자 주입으로 변경 (테스트 용이성, 불변성)

---

## 📋 즉시 실행 가능한 개선 사항

### 1단계: 데이터 마이그레이션 (최우선)

```sql
-- H2 콘솔에서 실행
UPDATE members SET grade = 'SOCIAL' WHERE grade = 'REGULAR';
UPDATE members SET grade = 'ELITE' WHERE grade = 'REGULAR_MEMBER';
UPDATE members SET grade = 'YOUTH' WHERE grade = 'PLAYER';

-- 확인
SELECT grade, COUNT(*) FROM members GROUP BY grade;
```

### 2단계: 불필요한 Fallback 로직 제거

마이그레이션 완료 후:
1. 각 컨트롤러에서 `migrateMemberGradesInSeparateTransaction()` 호출 제거
2. JdbcTemplate fallback 로직 제거 (JPA만 사용)
3. Member 정보 읽기 시 불필요한 try-catch 제거

### 3단계: 코드 정리

1. `BookingController` 리팩토링 (Service 레이어로 로직 이동)
2. 중복된 마이그레이션 로직 통합
3. 공통 유틸리티 메서드 생성

---

## 🎯 권장 개선 순서

### Phase 1: 긴급 (1-2일)
1. ✅ 데이터베이스 마이그레이션 실행
2. ✅ 불필요한 fallback 로직 제거
3. ✅ 마이그레이션 로직 중복 제거

### Phase 2: 중요 (1주)
4. ✅ BookingController 리팩토링
5. ✅ Service 레이어 통일 (우선순위 높은 컨트롤러부터)

### Phase 3: 개선 (2-4주)
6. ✅ 나머지 컨트롤러 Service 레이어 통일
7. ✅ 코드 중복 제거
8. ✅ 생성자 주입으로 변경

---

## 📊 코드 품질 지표

| 항목 | 현재 상태 | 목표 |
|------|----------|------|
| 컴파일 오류 | ✅ 0개 | ✅ 0개 |
| 린터 경고 | ⚠️ 12개 (타입 안전성) | ⚠️ 5개 이하 |
| 컨트롤러 평균 라인 수 | ⚠️ ~500라인 | ✅ ~300라인 |
| Service 레이어 사용률 | ⚠️ 30% | ✅ 100% |
| 코드 중복률 | ⚠️ 높음 | ✅ 낮음 |

---

## 🔍 추가 확인 사항

### 데이터베이스 상태 확인
```sql
-- 기존 등급 값이 남아있는지 확인
SELECT grade, COUNT(*) FROM members GROUP BY grade;

-- 예상 결과: SOCIAL, ELITE, YOUTH만 있어야 함
```

### 로그 확인
- 애플리케이션 시작 시 마이그레이션 로그 확인
- 각 API 호출 시 불필요한 마이그레이션 호출이 있는지 확인

---

## 결론

프로젝트는 **기능적으로는 정상 작동**하지만, **MemberGrade enum 변경으로 인한 복잡한 fallback 로직**이 코드 품질을 크게 저하시키고 있습니다.

**가장 시급한 작업:**
1. 데이터베이스 마이그레이션 실행 (5분)
2. 불필요한 fallback 로직 제거 (2-3시간)
3. 코드 정리 및 리팩토링 (1-2일)

이 작업들을 완료하면 코드 품질이 크게 개선되고 유지보수가 훨씬 쉬워질 것입니다.
