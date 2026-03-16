# 체크인 이용권 차감·팝업 숫자 검토 요약

## "차감 전" 값은 어디서 오나?

| 단계 | 위치 | 설명 |
|------|------|------|
| 1 | `AttendanceCheckController.decreaseCountPassUsage()` | **currentRemaining**: JDBC로 `member_products.remaining_count` 조회 (소문자/대문자 테이블 시도). 실패 시 `memberProduct.getRemainingCount()` |
| 2 | 같은 메서드 | **beforeRemaining**: `min(currentRemaining, 총횟수 - 이미_체크인된_건수)`. 이 값이 반환됨 |
| 3 | 체크인 API 응답 생성부 | **actualBefore** = `deductResultForResponse.getValue()` (= 위 beforeRemaining) |
| 4 | 같은 곳 | **beforeCount** = actualBefore (대관이면 rentalDisplayBefore 사용). `productDeducted.put("beforeCount", beforeCount)` |
| 5 | 프론트 `attendance.js` | `response.productDeducted.beforeCount` → "차감 전: N회" 로 표시 |

**정리:** "차감 전"은 백엔드에서 **DB의 `member_products.remaining_count`**(JDBC 직접 조회) 또는 그 조회 실패 시 **엔티티의 잔여 횟수**를 기준으로 정해지고, `min(그 값, 총횟수−이미 체크인 건수)`로 보정된 뒤 API → 프론트로 전달됩니다. 9회로 나오면 위 1단계에서 9가 들어오는 것(DB가 9이거나 JDBC 실패로 엔티티 9 사용)입니다.

---

## 현상
- 실제 잔여 8회인데 체크인 완료 팝업에 **차감 전 9회, 차감 후 8회**로 표시됨 (기대: 8회 → 7회).

---

## 원인 정리

### 1. JPA 영속 컨텍스트 캐시
- 예약 조회 시 `Booking`과 함께 로드된 `MemberProduct`가 **한 번 9로 로드**되면, 같은 트랜잭션 안에서 `findById()`를 다시 호출해도 **DB를 다시 읽지 않고** 같은 인스턴스(9)를 반환함.
- 그래서 “DB에서 다시 조회”해도 **예전 값(9)** 이 그대로 쓰일 수 있음.

### 2. 차감 로직 내부에서의 덮어쓰기 (이미 수정됨)
- `currentRemaining`을 DB/JDBC로 8을 읽어둔 뒤, **else** 블록에서 `currentRemaining = memberProduct.getRemainingCount()`로 다시 넣어 **캐시된 9**로 덮어쓰고 있던 부분이 있었음 → 해당 else 제거함.

### 3. JDBC 조회 실패 시 fallback
- `currentRemaining`을 JDBC로 먼저 구하고, 실패 시에만 `memberProduct.getRemainingCount()` 사용.
- H2 등에서 테이블/컬럼 대소문자(`member_products` vs `MEMBER_PRODUCTS`) 때문에 JDBC 쿼리가 실패하면, **항상 엔티티(캐시 9)** 로만 fallback 하여 9→8로 표시될 수 있음.

### 4. 중복/이중 경로
- “차감 전” 값은 **한 곳**에서만 정해져야 하는데,  
  - JDBC로 읽은 값  
  - 엔티티 `getRemainingCount()`  
  - (과거) else에서의 재대입  
  등 여러 경로가 섞여 있어, 캐시가 섞이면 9가 나올 수 있었음.

---

## 수정 사항 (적용됨)

1. **차감 직전 이용권 엔티티 DB 반영**  
   - 레슨/대관 모두 **`decreaseCountPassUsage` 호출 직전**에  
     `EntityManager.refresh(memberProductToUse)` 로 해당 이용권만 DB에서 다시 읽도록 함.  
   - 이렇게 하면 `findById`가 캐시를 주더라도, **차감에 쓰는 엔티티는 항상 최신 잔여**를 가짐.

2. **차감 로직 내 “차감 전” 단일 소스**  
   - `currentRemaining`은  
     - 1순위: JDBC로 `remaining_count` 직접 조회 (소문자/대문자 테이블·컬럼 두 가지 시도).  
     - 2순위: `refresh` 된 엔티티의 `getRemainingCount()`.  
   - **else에서 `currentRemaining`을 엔티티로 다시 덮어쓰지 않음** (해당 분기 제거됨).

3. **JDBC 이중 시도**  
   - `member_products` / `MEMBER_PRODUCTS` 등 DB별 대소문자 차이를 고려해,  
     두 가지 SQL로 시도하고, 하나라도 성공하면 그 값을 “차감 전”으로 사용.

4. **응답의 “차감 후”**  
   - “차감 후”는 **항상 (차감 전 - 1)** 로 계산해 넣어, 엔티티만 보고 있을 때의 어긋남을 방지.

---

## 흐름 요약 (수정 후)

1. 체크인 요청 → 예약 조회 (facility, member 위주).
2. 예약에 연결된 이용권 ID로 `findById` 후 **`entityManager.refresh(memberProductToUse)`** 로 DB와 동기화.
3. `decreaseCountPassUsage` 진입:
   - JDBC로 `remaining_count` 조회 (소문자/대문자 쿼리 시도).
   - 실패 시 `memberProduct.getRemainingCount()` 사용 (이미 refresh 되어 있음).
   - `beforeRemaining = min(현재 잔여, 총횟수 - 이미 체크인된 건수)`,  
     `afterRemaining = beforeRemaining - 1` 로 저장·반환.
4. 응답의 “차감 전” = 반환된 `beforeRemaining`, “차감 후” = `beforeRemaining - 1`.

---

## 확인 방법

- 서버 재시작 후 같은 회원으로 체크인했을 때  
  - **차감 전 8회, 차감 후 7회** 로 나오는지 확인.
- 로그에서 다음 확인:
  - `"체크인 차감: MemberProduct ID=... DB 잔여=...회"` → JDBC로 현재 잔여 읽음.
  - `"체크인 차감: MemberProduct ID=... DB 조회 불가, 엔티티 잔여 사용"` → JDBC 실패 시에만 엔티티 사용 (이 경우 refresh 덕분에 8이어야 함).

이후에도 9→8로 나오면, 위 로그와 사용 중인 DB(H2/MySQL 등)를 알려주면 JDBC 쿼리까지 추가로 맞출 수 있음.
