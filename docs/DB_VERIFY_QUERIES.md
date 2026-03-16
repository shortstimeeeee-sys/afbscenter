# DB에서 확인할 때 쓰는 쿼리

## 1. 회원별 이용권 목록 (상품명·잔여·총횟수)

```sql
SELECT mp.id AS 이용권ID, mp.member_id, m.name AS 회원명, p.name AS 상품명,
       mp.remaining_count AS 잔여, mp.total_count AS 총횟수, mp.status AS 상태
FROM member_products mp
JOIN members m ON m.id = mp.member_id
JOIN products p ON p.id = mp.product_id
ORDER BY m.name, p.name, mp.id;
```

---

## 2. 같은 회원·같은 상품 이용권이 2개 이상인지 (중복 확인)

```sql
SELECT mp.member_id, m.name AS 회원명, mp.product_id, p.name AS 상품명,
       COUNT(*) AS 이용권개수,
       GROUP_CONCAT(mp.id) AS 이용권ID목록
FROM member_products mp
JOIN members m ON m.id = mp.member_id
JOIN products p ON p.id = mp.product_id
GROUP BY mp.member_id, mp.product_id, m.name, p.name
HAVING COUNT(*) > 1
ORDER BY 이용권개수 DESC;
```

- `이용권개수`가 2 이상이면 같은 회원·같은 상품이 여러 개 있는 상태입니다.

---

## 3. 특정 회원(예: 하현진) 이용권만 보기

```sql
SELECT mp.id, mp.remaining_count AS 잔여, mp.total_count AS 총횟수, mp.status,
       p.name AS 상품명, mp.product_id
FROM member_products mp
JOIN members m ON m.id = mp.member_id
JOIN products p ON p.id = mp.product_id
WHERE m.name = '하현진'
ORDER BY mp.id;
```

---

## 4. 체크인/차감 반영 여부 (이용권별 출석 건수)

```sql
SELECT mp.id AS 이용권ID, m.name AS 회원명, p.name AS 상품명,
       mp.total_count AS 총횟수, mp.remaining_count AS DB잔여,
       (SELECT COUNT(*) FROM attendances a
        JOIN bookings b ON b.id = a.booking_id AND b.member_product_id = mp.id
        WHERE a.check_in_time IS NOT NULL) AS 체크인건수,
       mp.total_count - (SELECT COUNT(*) FROM attendances a
                        JOIN bookings b ON b.id = a.booking_id AND b.member_product_id = mp.id
                        WHERE a.check_in_time IS NOT NULL) AS 계산잔여
FROM member_products mp
JOIN members m ON m.id = mp.member_id
JOIN products p ON p.id = mp.product_id
WHERE mp.total_count IS NOT NULL AND mp.total_count > 0
ORDER BY m.name, p.name, mp.id;
```

- `DB잔여`와 `계산잔여`가 같으면 DB에 맞게 차감된 것입니다.

---

## 5. H2 콘솔에서 테이블/컬럼 이름이 다를 때

H2는 대소문자에 따라 테이블명이 다를 수 있습니다. 아래도 시도해보세요.

```sql
-- 소문자
SELECT * FROM member_products WHERE member_id = 92;
-- 대문자
SELECT * FROM MEMBER_PRODUCTS WHERE MEMBER_ID = 92;
```

필요하면 `INFORMATION_SCHEMA.TABLES` / `COLUMNS` 로 실제 이름을 확인할 수 있습니다.
