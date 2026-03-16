# 체크인 잔여 횟수 전체 검토

## 1. 정답 기준: DB

**실제 잔여 횟수의 기준은 DB 한 곳뿐입니다.**

- 테이블: `member_products`
- 컬럼: `remaining_count`
- 예: 이용권 ID 702 → `SELECT remaining_count FROM member_products WHERE id = 702;`

체크인 시 "가져오기"는 이 값을 읽고, -1 한 뒤 같은 컬럼을 업데이트합니다.  
그래서 **DB가 정확한지 먼저 확인**해야 합니다.

---

## 2. DB 확인용 SQL (H2)

```sql
-- 이용권 702 현재 잔여 (소문자)
SELECT id, remaining_count, total_count FROM member_products WHERE id = 702;

-- H2 대문자 테이블일 때
SELECT id, REMAINING_COUNT, TOTAL_COUNT FROM MEMBER_PRODUCTS WHERE id = 702;
```

- 체크인 **직전**에 위 쿼리로 `remaining_count`를 확인합니다.
- 예: 8이면 체크인 후에는 7이어야 하고, 팝업에도 "차감 전 8회, 차감 후 7회"로 나와야 합니다.
- 만약 DB는 8인데 팝업에 10→9가 나오면 → **코드에서 10을 쓰고 있는 것**이므로, 아래 3번 로그로 어디서 10이 나오는지 확인합니다.

---

## 3. 체크인 시 서버 로그로 "가져오기" 확인

체크인 한 번 하고 **서버 콘솔**에서 다음 로그를 봅니다.

| 로그 메시지 | 의미 |
|-------------|------|
| `[잔여조회] MemberProduct ID=702 → DB remaining_count=8` | **DB에서 8을 정상 읽음** → 차감 전 8, 차감 후 7로 나와야 함 |
| `[잔여조회] MemberProduct ID=702 → 모두 실패, null (엔티티 값 사용됨)` | DB 조회 실패 → **엔티티(캐시) 값**을 쓰는 중. 그 다음 줄에 "엔티티 잔여 사용. ... 잔여=10회" 등으로 실제 사용 값 확인 |
| `체크인 차감 전: DB 조회 null → 엔티티 잔여 사용. ... 잔여=10회` | 위와 같은 경우, **10은 DB가 아니라 엔티티**에서 온 값 |

- **DB가 8인데 10이 나온다** → `[잔여조회] ... 모두 실패` 또는 `엔티티 잔여 사용 ... 10회`가 찍혀 있을 가능성이 큼.  
  → H2 테이블/컬럼 이름(대소문자, 따옴표)이 맞는지 확인 필요.
- **DB가 10**이면 → 로직은 맞고, **DB 값이 10**이기 때문에 10→9로 나오는 것이 맞습니다.

---

## 4. 체크인 흐름 (단일 경로 정리)

- **잔여 읽기 (한 곳)**  
  `MemberProductQueryService.getRemainingCountFromDb(memberProductId)`  
  - REQUIRES_NEW 트랜잭션에서 JDBC로 `member_products.remaining_count`만 조회.  
  - 실패 시 null → 컨트롤러에서 refresh 후 엔티티 `getRemainingCount()` 사용.

- **차감 (한 곳)**  
  `decreaseCountPassUsage(..., knownRemaining)`  
  - `knownRemaining`이 있으면 그대로 "차감 전"으로 사용.  
  - 차감 후 = 차감 전 - 1, 총 횟수 초과 시 상한 적용 후 저장.

- **응답 (한 곳)**  
  - `beforeCount` = `deductResultForResponse.getValue()` (차감 로직이 쓴 "차감 전").  
  - `afterCount` = `beforeCount - 1` (총 횟수 초과 시 cap).

중복: **잔여를 읽는 곳**은 서비스 1곳 + (실패 시) 엔티티 1곳뿐입니다.  
차감은 `decreaseCountPassUsage` 한 곳, 응답은 위 한 번만 조합합니다.

---

## 5. 10→9가 나올 수 있는 경우

1. **DB에 실제로 10이 들어 있는 경우**  
   - 이전 체크인이 반영 안 됐거나, 다른 경로에서 10으로 세팅된 경우.  
   - → 위 2번 SQL로 `member_products` 확인.

2. **DB 조회가 실패해서 엔티티(10)를 쓰는 경우**  
   - 예전에 로드된 10이 캐시에 남아 있음.  
   - → 서버 로그에 `[잔여조회] ... 모두 실패` 또는 `엔티티 잔여 사용 ... 10회` 확인.

3. **같은 회원이 702 말고 다른 이용권으로 체크인하는 경우**  
   - 702가 아니라 다른 행이 차감되면, 702 기준으로는 여전히 10일 수 있음.  
   - → 로그의 `MemberProduct ID=` 값이 702가 맞는지 확인.

---

## 6. 다음 확인 순서

1. **DB 확인**  
   체크인 직전에 `SELECT id, remaining_count, total_count FROM member_products WHERE id = 702;` 실행 → `remaining_count` 값 확인.
2. **체크인 1회** 후 **서버 로그**에서  
   `[잔여조회] MemberProduct ID=702` / `체크인 차감 전:` / `엔티티 잔여 사용` 여부 확인.
3. **DB 재확인**  
   체크인 후 같은 쿼리로 `remaining_count`가 1 줄었는지 확인.

이 순서로 하면 **DB가 정확한지**, **코드가 DB를 제대로 가져오는지** 구분할 수 있습니다.
