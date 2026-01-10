# 프로젝트 문제점 및 개선 사항

## 🔴 심각한 문제 (즉시 수정 권장)

### 1. 보안 취약점

#### 1-1. CORS 설정이 너무 개방적
- **위치**: 모든 컨트롤러에 `@CrossOrigin(origins = "*")`
- **문제**: 모든 도메인에서 API 접근 허용
- **위험**: CSRF 공격, 데이터 유출 위험
- **권장**: 프로덕션 환경에서는 특정 도메인만 허용
  ```java
  @CrossOrigin(origins = "http://localhost:8080") // 개발 환경
  // 또는
  @CrossOrigin(origins = {"https://yourdomain.com"}) // 프로덕션
  ```

#### 1-2. H2 콘솔 활성화 (프로덕션 위험)
- **위치**: `application.properties` - `spring.h2.console.enabled=true`
- **문제**: 프로덕션에서 데이터베이스 직접 접근 가능
- **위험**: 데이터 유출, 삭제, 수정 위험
- **권장**: 프로덕션에서는 비활성화하거나 인증 추가

#### 1-3. 빈 데이터베이스 비밀번호
- **위치**: `application.properties` - `spring.datasource.password=`
- **문제**: 비밀번호가 없음
- **위험**: 무단 접근 가능
- **권장**: 강력한 비밀번호 설정

#### 1-4. SQL 인젝션 가능성
- **위치**: `BookingController.java:827` - `resetBookingSequence()`
- **문제**: 문자열 연결로 SQL 생성
  ```java
  String sql = "ALTER TABLE bookings ALTER COLUMN id RESTART WITH " + nextValue;
  ```
- **위험**: SQL 인젝션 공격 가능
- **권장**: PreparedStatement 또는 파라미터화된 쿼리 사용

### 2. 타입 안전성 문제

#### 2-1. Map<String, Object> 사용으로 인한 타입 캐스팅 위험
- **위치**: `BookingController.createBooking()`, `MemberController.assignProductToMember()`
- **문제**: 런타임에 ClassCastException 발생 가능
  ```java
  Long facilityId = ((Number) facilityMap.get("id")).longValue();
  ```
- **위험**: 잘못된 타입 전달 시 애플리케이션 크래시
- **권장**: DTO 클래스 사용 또는 더 안전한 타입 변환

#### 2-2. Null 체크 부족
- **위치**: 여러 컨트롤러에서 Map.get() 결과에 대한 null 체크 부족
- **문제**: NullPointerException 발생 가능
- **권장**: Optional 사용 또는 명시적 null 체크

### 3. 프로덕션 설정 문제

#### 3-1. DEBUG 로깅 레벨
- **위치**: `application.properties` - `logging.level.com.afbscenter=DEBUG`
- **문제**: 프로덕션에서 과도한 로그 출력
- **영향**: 성능 저하, 로그 파일 크기 증가
- **권장**: 프로덕션에서는 INFO 또는 WARN 레벨

#### 3-2. SQL 쿼리 출력 활성화
- **위치**: `application.properties` - `spring.jpa.show-sql=true`
- **문제**: 모든 SQL 쿼리가 콘솔에 출력
- **영향**: 성능 저하, 민감한 데이터 노출 가능
- **권장**: 프로덕션에서는 false

#### 3-3. DDL 자동 업데이트
- **위치**: `application.properties` - `spring.jpa.hibernate.ddl-auto=update`
- **문제**: 프로덕션에서 스키마 자동 변경
- **위험**: 데이터 손실 가능성
- **권장**: 프로덕션에서는 `validate` 또는 `none`

## ⚠️ 중간 수준 문제 (점진적 개선)

### 4. 아키텍처 일관성

#### 4-1. Service 레이어 불일치
- **문제**: 일부 컨트롤러는 Service 사용, 일부는 Repository 직접 사용
- **영향**: 비즈니스 로직 분산, 유지보수 어려움
- **권장**: 모든 컨트롤러가 Service 레이어를 통해 접근

### 5. 에러 처리

#### 5-1. 예외를 조용히 무시
- **위치**: 여러 곳에서 catch 블록에서 예외를 무시
- **문제**: 오류 추적 어려움
- **권장**: 최소한 로그는 남기기 (이미 로깅 프레임워크로 개선됨)

#### 5-2. 공통 에러 핸들러 부재
- **문제**: 각 컨트롤러마다 개별 에러 처리
- **영향**: 코드 중복, 일관성 부족
- **권장**: `@ControllerAdvice`를 사용한 전역 에러 핸들러

### 6. 입력 검증

#### 6-1. Bean Validation 미사용
- **문제**: `@Valid`, `@NotNull`, `@Size` 등 검증 어노테이션 미사용
- **영향**: 잘못된 데이터가 데이터베이스에 저장될 수 있음
- **권장**: JSR-303 Bean Validation 사용

### 7. 트랜잭션 관리

#### 7-1. 일부 메서드에 @Transactional 누락 가능성
- **문제**: 여러 Repository 호출 시 트랜잭션 경계 불명확
- **영향**: 데이터 일관성 문제 가능
- **권장**: Service 레이어에서 트랜잭션 관리

## 💡 개선 권장 사항 (낮은 우선순위)

### 8. 코드 품질

#### 8-1. 코드 중복
- **문제**: 컨트롤러마다 유사한 CRUD 패턴 반복
- **권장**: 공통 베이스 컨트롤러 또는 유틸리티 클래스

#### 8-2. 매직 넘버/문자열
- **문제**: 하드코딩된 값들
- **권장**: 상수 클래스 또는 설정 파일로 분리

### 9. 테스트

#### 9-1. 유닛 테스트 부재
- **문제**: 테스트 코드 없음
- **영향**: 리팩토링 시 회귀 버그 위험
- **권장**: JUnit을 사용한 유닛 테스트 작성

### 10. 문서화

#### 10-1. API 문서 부재
- **문제**: Swagger/OpenAPI 문서 없음
- **영향**: API 사용법 파악 어려움
- **권장**: SpringDoc OpenAPI 추가

## 📊 우선순위별 개선 계획

### 즉시 수정 (보안)
1. CORS 설정 제한
2. H2 콘솔 비활성화 (프로덕션)
3. 데이터베이스 비밀번호 설정
4. SQL 인젝션 방지

### 단기 개선 (1-2주)
5. 타입 안전성 개선 (DTO 사용)
6. Null 체크 강화
7. 프로덕션 설정 분리 (application-prod.properties)
8. Bean Validation 추가

### 중기 개선 (1-2개월)
9. Service 레이어 통일
10. 공통 에러 핸들러 추가
11. 트랜잭션 관리 개선

### 장기 개선 (선택적)
12. 테스트 코드 작성
13. API 문서화
14. 코드 중복 제거
