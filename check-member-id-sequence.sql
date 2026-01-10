-- MEMBERS 테이블의 ID 시퀀스 확인 및 조정

-- 1. 현재 회원 수와 최대 ID 확인
SELECT COUNT(*) as member_count FROM members;
SELECT MAX(id) as max_id FROM members;
SELECT id, name, member_number FROM members ORDER BY id;

-- 2. 현재 시퀀스 값 확인 (H2에서는 INFORMATION_SCHEMA 사용)
SELECT * FROM INFORMATION_SCHEMA.SEQUENCES WHERE SEQUENCE_NAME LIKE '%MEMBERS%';

-- 3. ID 시퀀스를 현재 최대 ID + 1로 리셋
-- (예: 회원이 1명이고 ID가 1이면, 시퀀스를 2로 설정)
-- ALTER TABLE members ALTER COLUMN id RESTART WITH 2;

-- 4. 또는 ID 시퀀스를 현재 회원 수 + 1로 리셋
-- (회원이 1명이면 시퀀스를 2로 설정)
-- ALTER TABLE members ALTER COLUMN id RESTART WITH (SELECT COUNT(*) + 1 FROM members);
