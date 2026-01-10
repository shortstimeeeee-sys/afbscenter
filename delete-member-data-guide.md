# 회원 정보 관련 테이블 데이터 삭제 가이드

## 방법 1: H2 콘솔 사용 (권장)

1. 서버 실행 중에 브라우저에서 접속:
   ```
   http://localhost:8080/h2-console
   ```

2. 연결 정보 입력:
   - JDBC URL: `jdbc:h2:file:./data/afbscenter`
   - 사용자명: `sa`
   - 비밀번호: (비워두기)

3. 다음 SQL 명령어들을 순서대로 실행:

```sql
-- 1. 회원과 관련된 자식 테이블 데이터 삭제
DELETE FROM baseball_records;
DELETE FROM member_products;
DELETE FROM bookings;
DELETE FROM attendances;
DELETE FROM lessons;
DELETE FROM training_logs;

-- 2. 결제 테이블에서 회원 관련 데이터 삭제
DELETE FROM payments WHERE member_id IS NOT NULL;

-- 3. 메인 회원 테이블 데이터 삭제
DELETE FROM members;

-- 4. ID 시퀀스를 1로 리셋 (다음 회원이 ID=1부터 시작)
ALTER TABLE members ALTER COLUMN id RESTART WITH 1;
```

## 방법 2: SQL 파일 실행

`delete-member-data.sql` 파일을 H2 콘솔에서 실행하거나, 
Spring Boot 애플리케이션에서 직접 실행할 수 있습니다.

## 주의사항

⚠️ **이 작업은 되돌릴 수 없습니다!**
- 모든 회원 데이터가 영구적으로 삭제됩니다.
- 관련된 예약, 결제, 출석, 레슨, 훈련 로그 등도 모두 삭제됩니다.
- 삭제 전에 백업을 권장합니다.

## 삭제 순서가 중요한 이유

외래키 제약조건 때문에 자식 테이블부터 삭제해야 합니다:
- `baseball_records` → `members` 참조
- `member_products` → `members` 참조
- `bookings` → `members` 참조
- `attendances` → `members` 참조
- `lessons` → `members` 참조
- `training_logs` → `members` 참조
- `payments` → `members` 참조 (있는 경우)

## 삭제 후 확인

```sql
-- 각 테이블의 데이터 개수 확인
SELECT COUNT(*) as member_count FROM members;
SELECT COUNT(*) as booking_count FROM bookings;
SELECT COUNT(*) as member_product_count FROM member_products;
SELECT COUNT(*) as attendance_count FROM attendances;
```

모든 결과가 0이면 정상적으로 삭제된 것입니다.
