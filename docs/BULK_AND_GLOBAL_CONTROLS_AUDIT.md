# 전체/일괄 통제 버튼 현황 (관리자 제한 및 DB 로그)

## 조사 결과 요약 (적용 완료 반영)

| # | 기능 | 위치 | API | 관리자만 사용 | DB 로그 |
|---|------|------|-----|--------------|---------|
| 1 | **예약 일괄 승인** | 예약·대관 승인대기 모달 | `POST /api/bookings/bulk-confirm` | ✅ 백엔드 403 + 프론트 버튼 숨김 | ✅ `booking_audit_logs` (BULK_CONFIRM) |
| 2 | **회원 전체 삭제** | 회원 관리 | `DELETE /api/members/all` | ✅ 백엔드 403 + 프론트 ADMIN만 표시 | ✅ `action_audit_logs` (DELETE_ALL_MEMBERS) |
| 3 | **전체 체크인** | 출석 | 반복 `POST /api/attendance/checkin` | ✅ 프론트 버튼 ADMIN만 표시 | ❌ (개별 체크인 호출만 있어 단일 로그 없음) |
| 4 | **이용권 데이터 일괄 수정** | 상품 | `POST /api/products/batch-update-all` | ✅ 백엔드 403 + 프론트 버튼 ADMIN만 표시 | ✅ `action_audit_logs` (BATCH_UPDATE_ALL_PRODUCTS) |
| 5 | **기간제 conditions 일괄 업데이트** | 상품(레거시) | `POST /api/products/batch-update-monthly-pass-conditions` | ✅ 백엔드 403 | ✅ `action_audit_logs` (BATCH_UPDATE_MONTHLY_PASS_CONDITIONS) |
| 6 | **누락된 결제 일괄 생성** | 결제 | `POST /api/members/batch/create-missing-payments` | ✅ 백엔드 403 + 프론트 버튼 ADMIN만 표시 | ✅ `action_audit_logs` (BATCH_CREATE_MISSING_PAYMENTS) |
| 7 | **이용중 출석 기록 모두 리셋** | 출석 | `DELETE /api/attendance/reset-incomplete` | ✅ 백엔드 403 + 프론트 버튼 ADMIN만 표시 | ✅ `action_audit_logs` (RESET_INCOMPLETE_ATTENDANCES) |
| 8 | **1개 보유 회원 일괄 연결** | 예약(미연결 상품) | GET + 반복 PUT `/bookings/:id` | ❌ 제한 없음 | ❌ 없음 |
| 9 | **시설 슬롯 일괄 저장** | 시설 | `PUT /api/facilities/:id/slots` | ❌ (일반 수정 권한) | ❌ 없음 |

---

## DB 로그 테이블

- **booking_audit_logs**: 예약 일괄 승인 (BULK_CONFIRM). 컬럼: username, action, details(JSON), created_at.
- **action_audit_logs**: 회원 전체 삭제, 상품 일괄 수정 2종, 결제 일괄 생성, 출석 리셋. 컬럼: username, action, details(JSON), created_at.

---

## 미적용(선택) 항목
- **일괄 연결**(8), **시설 슬롯**(9): 운영 범위가 제한적이어서 관리자 전용/로그는 적용하지 않음. 필요 시 동일 방식으로 추가 가능.
