# 프로그램 점검 보고서 – 데이터 일관성 및 동작 검토

점검 일자: 2026-03-16  
점검 범위: 같은 데이터가 다르게 나오는 경우, 기능 오동작 가능성

---

## 1. 정상으로 보이는 부분

### 1.1 횟수권(COUNT_PASS) 잔여 횟수
- **회원 목록 API** (`MemberService.getAllMembersWithFilters`): COUNT_PASS에 대해 `totalCount - actualUsedCount`(출석 우선, 없으면 예약 건수)로 계산 후 `mp.setRemainingCount()`로 넣어 DTO에 전달.
- **회원 상세 이용권** (`MemberDetailQueryController` GET `/{memberId}/products`): 동일하게 `actualUsedCount = 출석 > 0 ? 출석 : 예약`, `remainingCount = totalCount - actualUsedCount`.
- **예약/체크인** 측: `countConfirmedBookingsByMemberProductId`가 “체크인된 예약만” 카운트하므로, 출석 건수와 혼선 없이 사용 가능.
- **결론**: COUNT_PASS 잔여는 회원 목록·회원 상세·통일 로직으로 일치하도록 되어 있음.

### 1.2 날짜/시간 표시
- 프론트에서는 `App.formatDate`, `App.formatDateTime`(common.js)을 공통 사용.
- 같은 값이면 화면별로 포맷이 어긋날 가능성은 낮음.

### 1.3 회원 상태 라벨
- `App.Status.member`: ACTIVE=활성, INACTIVE=휴면, WITHDRAWN=탈퇴로 common.js에 정의되어 있고, 회원 관련 화면에서 공통 사용.

### 1.4 종료 배지·통계
- 목록의 “종료” 배지: `checkMemberHasExpired()` (이용권 전부/일부 종료 + 3일 규칙).
- 상단 “종료” 카드: `endedTicketMemberCount` (동일 규칙으로 백엔드 집계).
- 둘 다 같은 “이용권 종료” 기준으로 맞춰져 있음.

---

## 2. 확인이 필요한 부분 (잠재적 불일치)

### 2.1 사용 횟수(actualUsedCount) 계산 방식 한 곳만 상이 → **수정 완료**
- **대부분**: `actualUsedCount = (출석 건수 > 0) ? 출석 건수 : 예약 건수` (출석 우선).
- **예외였던 곳**: `AttendanceCheckController` 체크인 시 잔여 재계산 블록에서만 `Math.max(출석, 예약)` 사용.
- **조치**: 해당 구간을 “출석 > 0이면 출석, 아니면 예약”으로 변경해 회원 목록·상세와 동일 기준으로 통일함.

### 2.2 패키지 상품(TEAM_PACKAGE) 잔여 → **수정 완료**
- **회원 목록**: 기존에는 COUNT_PASS만 재계산하고 패키지는 DB 값 그대로 사용.
- **회원 상세**: 패키지에 대해 JSON 합산·히스토리 등으로 잔여 표시.
- **조치**: `MemberService`에서 `package_items_remaining` JSON이 있는 상품에 대해 항목별 `remaining` 합산을 계산해 `setRemainingCount(sum)` 적용. 목록에서도 상세와 같은 “JSON 합산 잔여”가 나오도록 통일함.

### 2.3 무제한권/기타 상품 타입
- 무제한권(예: totalCount/usageCount 999 이상 등) 처리와 “선택된 이용권만 차감” 로직은 이전에 정리된 상태.
- 다른 상품 타입에서 “같은 데이터가 다르게 나온다”는 추가 패턴은 점검 범위 내에서 발견되지 않음.

---

## 3. 기능 동작 관련

### 3.1 체크인·이용권 차감
- 패키지: `package_items_remaining` 비어 있으면 초기화, 차감 시 상한(totalCount) 적용되어 10회권에 11·12처럼 저장되던 문제는 수정된 상태로 보임.
- 복구 시에도 totalCount 상한 적용되어 있음.

### 3.2 회원 통계 “종료”
- 상단 “종료” 카드는 `endedTicketMemberCount`(이용권 종료 기준) 사용.
- 목록 “종료” 배지와 동일 규칙(1개 종료·전부 종료·일부만 종료 시 3일)으로 맞춰져 있음.

### 3.3 JPQL enum 참조
- `MemberProductRepository`의 `countMembersWithPartialEndedSince`, `findMemberIdsWithPartialEndedSince`에서 JPQL 내 enum을 문자열('EXPIRED', 'USED_UP', 'ACTIVE')로 수정된 상태.  
  추가로 같은 패턴이 있으면 전부 문자열로 통일하는 것이 안전함.

---

## 4. 요약

| 구분 | 내용 | 조치 권장 |
|------|------|------------|
| COUNT_PASS 잔여 | 목록·상세·체크인 모두 totalCount−actualUsedCount(출석 우선)로 통일됨 | 유지 |
| actualUsedCount 한 곳 | 체크인 재계산만 max(출석, 예약) 사용 | 출석 우선으로 통일 권장 |
| 패키지 잔여 | 목록은 DB/JSON 그대로, 상세는 보정값 → 다를 수 있음 | 목록 정책 결정 후 통일 권장 |
| 날짜/상태/종료 | 공통 함수·동일 규칙 사용 | 유지 |

전체적으로 “같은 데이터가 화면마다 다르게 나오는” 문제는 **횟수권 잔여**는 이미 통일되어 있고, **패키지 잔여**와 **체크인 시 한 구간의 사용 횟수 계산**만 위와 같이 정리하면 더 일관되게 유지할 수 있습니다.
