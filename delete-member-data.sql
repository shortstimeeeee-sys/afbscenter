-- 회원 정보 관련 모든 데이터 삭제
-- 외래키 제약조건 때문에 자식 테이블부터 삭제해야 합니다.

-- 1. 회원과 관련된 자식 테이블 데이터 삭제
DELETE FROM baseball_records;
DELETE FROM member_products;
DELETE FROM bookings;
DELETE FROM attendances;
DELETE FROM lessons;
DELETE FROM training_logs;

-- 2. 결제 테이블에서 회원 관련 데이터 삭제 (member_id가 있는 경우)
DELETE FROM payments WHERE member_id IS NOT NULL;

-- 3. 메인 회원 테이블 데이터 삭제
DELETE FROM members;

-- 4. ID 시퀀스를 1로 리셋 (다음 회원이 ID=1부터 시작)
ALTER TABLE members ALTER COLUMN id RESTART WITH 1;

-- 확인용: 삭제 후 데이터 확인
SELECT COUNT(*) as member_count FROM members;
SELECT COUNT(*) as booking_count FROM bookings;
SELECT COUNT(*) as member_product_count FROM member_products;


-- 1. 자식 테이블부터 삭제 (외래키 제약조건 때문에)
DELETE FROM baseball_records;
DELETE FROM member_products;
DELETE FROM bookings;
DELETE FROM attendances;
DELETE FROM lessons;
DELETE FROM training_logs;
DELETE FROM payments WHERE member_id IS NOT NULL;

-- 2. 메인 회원 테이블 삭제
DELETE FROM members;
