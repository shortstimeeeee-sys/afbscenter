-- MEMBERS 테이블의 ID 시퀀스를 현재 회원 수에 맞게 조정
-- 회원이 1명이고 ID가 1이면, 시퀀스를 2로 설정 (다음 회원이 ID=2를 받도록)

-- 1. 현재 상태 확인
SELECT COUNT(*) as member_count FROM members;
SELECT MAX(id) as max_id FROM members;
SELECT id, name, member_number FROM members ORDER BY id;

-- 2. ID 시퀀스를 현재 최대 ID + 1로 리셋
-- (회원이 1명이고 ID가 1이면, 시퀀스를 2로 설정)
ALTER TABLE members ALTER COLUMN id RESTART WITH (SELECT COALESCE(MAX(id), 0) + 1 FROM members);

-- 3. 확인 (다시 조회)
SELECT COUNT(*) as member_count FROM members;
SELECT MAX(id) as max_id FROM members;
