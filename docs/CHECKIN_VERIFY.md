# 체크인 "차감 전" 정보 확인 가이드

## 1. "차감 전(beforeCount)" 값의 출처 (코드 기준)

| 단계 | 파일·위치 | 내용 |
|------|-----------|------|
| 1 | `AttendanceCheckController.decreaseCountPassUsage()` 329~352행 | **currentRemaining** = JDBC로 `member_products.remaining_count` 조회 (소문자/대문자 SQL 둘 다 시도). 실패 시 `memberProduct.getRemainingCount()` |
| 2 | 같은 메서드 434~444행 | **beforeRemaining** = `currentRemaining` 또는 `min(currentRemaining, 총횟수 - 이미_체크인_건수)`. 이 값이 반환됨 |
| 3 | 같은 컨트롤러 834행 | **actualBefore** = `deductResultForResponse.getValue()` (= 위 beforeRemaining) |
| 4 | 844, 871행 | **beforeCount** = actualBefore → `productDeducted.put("beforeCount", beforeCount)` |
| 5 | 프론트 `attendance.js` | `response.productDeducted.beforeCount` → "차감 전: N회" 표시 |

---

## 2. 서버 로그로 확인할 것 (Spring Boot 실행 콘솔)

체크인 요청이 들어왔을 때 **아래 둘 중 하나**가 반드시 찍힙니다.

- **JDBC로 DB 값을 쓴 경우 (정상)**  
  `체크인 차감: MemberProduct ID=xxx DB 잔여=N회`  
  → 이때 N이 API의 **beforeCount**로 내려감. N이 9면 DB에 그 시점에 9로 저장돼 있었던 것.

- **JDBC 실패 후 엔티티 값을 쓴 경우**  
  `체크인 차감: MemberProduct ID=xxx DB 조회 불가, 엔티티 잔여 사용 (캐시값일 수 있음)`  
  → 이때는 **beforeCount**가 엔티티의 `remainingCount`(캐시일 수 있음)로 설정됨.

**확인 방법:** 체크인 버튼 클릭 직후, 터미널/IDE에서 Spring Boot 로그를 위 문구로 검색.

---

## 3. DB에서 직접 확인 (선택)

체크인 **직전** 해당 이용권의 잔여가 몇이었는지 보려면:

```sql
-- 회원명으로 이용권 조회 (예: 하현진)
SELECT mp.id, mp.member_id, m.name, mp.product_id, mp.remaining_count, mp.total_count, mp.status
FROM member_products mp
JOIN members m ON m.id = mp.member_id
WHERE m.name = '하현진';
```

- `remaining_count`가 체크인 직전 8이었는데 화면에 "차감 전 9"가 나왔다면, 서버는 **엔티티(캐시) 값 9**를 쓰고 있는 것 → 위 로그에서 "DB 조회 불가"가 찍혀 있을 가능성 큼.

---

## 4. 엔티티/테이블 정보 (참고)

- **테이블:** `member_products` (엔티티 `@Table(name = "member_products")`)
- **컬럼:** `remaining_count` (엔티티 `@Column(name = "remaining_count")`)
- H2 대소문자 대비해 JDBC는 `member_products` / `MEMBER_PRODUCTS` 둘 다 시도하도록 되어 있음.

---

## 5. 한 줄 요약

- **beforeCount(차감 전)** 는 백엔드에서 **JDBC로 읽은 `member_products.remaining_count`** 또는 (조회 실패 시) **엔티티 잔여**로 정해지고, 그대로 API → 프론트로 전달됨.
- **정보 확인**은 **서버 콘솔 로그**에서 "체크인 차감: MemberProduct ID=... DB 잔여=...회" 또는 "DB 조회 불가"가 나오는지 보면 됨.
