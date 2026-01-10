-- MEMBERS 테이블의 ID 시퀀스를 1로 리셋
-- 이 스크립트는 모든 회원 데이터를 삭제한 후 실행해야 합니다.

-- 1. 모든 회원 관련 데이터 삭제 (외래키 제약조건 때문에 자식 테이블부터)
DELETE FROM baseball_records;
DELETE FROM member_products;
DELETE FROM bookings;
DELETE FROM attendances;
DELETE FROM lessons;
DELETE FROM training_logs;
DELETE FROM payments WHERE member_id IS NOT NULL;
DELETE FROM members;

-- 2. ID 시퀀스를 1로 리셋 (다음 회원이 ID=1부터 시작)
ALTER TABLE members ALTER COLUMN id RESTART WITH 1;

-- 확인
SELECT COUNT(*) as member_count FROM members;
SELECT MAX(id) as max_id FROM members;
