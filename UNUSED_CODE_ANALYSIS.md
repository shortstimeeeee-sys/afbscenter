# 사용되지 않는 코드 분석 보고서

**작성일**: 2026-01-10  
**프로젝트**: AFBS Center

## 📊 분석 요약

프로젝트 내에서 **사용되지 않는 코드와 불필요한 기능**을 확인한 결과, 다음과 같은 항목들이 발견되었습니다:

---

## ❌ 사용되지 않는 모델 및 리포지토리

### 1. User 모델 및 UserRepository
- **위치**: `model/User.java`, `repository/UserRepository.java`
- **상태**: ❌ 사용되지 않음
- **이유**: 
  - UserController가 존재하지 않음
  - 프론트엔드에서 User 관련 API 호출 없음
  - 인증/인가 메커니즘이 구현되지 않아 사용되지 않음
- **권장**: 인증/인가 구현 시 사용 예정이므로 **보관 권장**

### 2. Message 모델 및 MessageRepository
- **위치**: `model/Message.java`, `repository/MessageRepository.java`
- **상태**: ⚠️ 부분 사용
- **이유**: 
  - `announcements.js`에서 `/messages` API 호출하지만 **MessageController가 없음**
  - 백엔드 API 엔드포인트가 구현되지 않음
- **권장**: MessageController 구현 필요 또는 프론트엔드 코드 수정

### 3. Announcement 모델 및 AnnouncementRepository
- **위치**: `model/Announcement.java`, `repository/AnnouncementRepository.java`
- **상태**: ⚠️ 부분 사용
- **이유**: 
  - `announcements.js`에서 `/announcements` API 호출하지만 **AnnouncementController가 없음**
  - 백엔드 API 엔드포인트가 구현되지 않음
- **권장**: AnnouncementController 구현 필요 또는 프론트엔드 코드 수정

### 4. Setting 모델 및 SettingRepository
- **위치**: `model/Setting.java`, `repository/SettingRepository.java`
- **상태**: ❌ 사용되지 않음
- **이유**: 
  - SettingController가 존재하지 않음
  - 프론트엔드에서 Setting 관련 API 호출 없음
- **권장**: 설정 기능이 필요하면 Controller 구현, 아니면 삭제 가능

### 5. Lesson 모델 및 LessonRepository
- **위치**: `model/Lesson.java`, `repository/LessonRepository.java`
- **상태**: ⚠️ 부분 사용
- **이유**: 
  - `coaches.js`에서 `/lessons` API 호출하지만 **LessonController가 없음**
  - Booking 모델에서 `Lesson.LessonCategory` enum은 사용 중
- **권장**: LessonController 구현 필요 또는 프론트엔드 코드 수정

### 6. FacilitySlot 모델 및 FacilitySlotRepository
- **위치**: `model/FacilitySlot.java`, `repository/FacilitySlotRepository.java`
- **상태**: ❌ 사용되지 않음
- **이유**: 
  - FacilitySlotController가 존재하지 않음
  - 프론트엔드에서 FacilitySlot 관련 API 호출 없음
  - Facility 모델에서 관계는 정의되어 있으나 실제 사용 안 함
- **권장**: 시설 슬롯 기능이 필요하면 Controller 구현, 아니면 삭제 가능

---

## ❌ 사용되지 않는 컨트롤러

### 1. DatabaseCheckController
- **위치**: `controller/DatabaseCheckController.java`
- **상태**: ❌ 사용되지 않음
- **이유**: 
  - 프론트엔드에서 `/api/db-check` 또는 `/api/database-check` API 호출 없음
  - 개발/디버깅용으로 보임
- **엔드포인트**: `/api/db-check/columns`
- **권장**: 개발용이므로 **삭제 가능** 또는 개발 환경에서만 활성화

---

## ⚠️ 프론트엔드에서 호출하지만 백엔드가 없는 API

### 1. `/api/announcements` (GET, POST, DELETE)
- **호출 위치**: `announcements.js`
- **상태**: ⚠️ 백엔드 미구현
- **영향**: 공지사항 기능이 작동하지 않음
- **권장**: AnnouncementController 구현 필요

### 2. `/api/messages` (GET, POST)
- **호출 위치**: `announcements.js`
- **상태**: ⚠️ 백엔드 미구현
- **영향**: 메시지 발송 기능이 작동하지 않음
- **권장**: MessageController 구현 필요

### 3. `/api/analytics`
- **호출 위치**: `analytics.js`
- **상태**: ⚠️ 백엔드 미구현
- **영향**: 통계/분석 페이지가 작동하지 않음
- **권장**: AnalyticsController 구현 필요 또는 DashboardController에 통합

### 4. `/api/lessons`
- **호출 위치**: `coaches.js`
- **상태**: ⚠️ 백엔드 미구현
- **영향**: 레슨 목록 조회 기능이 작동하지 않음
- **권장**: LessonController 구현 필요

---

## 📁 불필요한 파일들

### 1. SQL 스크립트 파일들
- **위치**: 프로젝트 루트
- **파일들**:
  - `check-member-id-sequence.sql`
  - `fix-member-id-sequence.sql`
  - `check_new_columns.sql`
  - `delete-member-data.sql`
  - `reset-member-id.sql`
- **상태**: ❌ 일회성 스크립트
- **권장**: 
  - 이미 실행 완료된 스크립트는 삭제 가능
  - 필요시 `scripts/` 폴더로 이동하여 보관

### 2. 문서 파일들
- **파일들**:
  - `ngrok-사용법.md` - ngrok 사용 가이드 (일회성)
  - `delete-member-data-guide.md` - 데이터 삭제 가이드 (일회성)
  - `PROJECT_STRUCTURE.md` - 프로젝트 구조 문서 (중복 가능)
- **권장**: 
  - 일회성 가이드는 삭제 또는 `docs/archive/` 폴더로 이동
  - 중복 문서는 통합

---

## 📊 사용 현황 요약

### ✅ 실제 사용 중인 컨트롤러 (11개)
1. ProductController ✅
2. FacilityController ✅
3. AttendanceController ✅
4. PaymentController ✅
5. TrainingLogController ✅
6. BookingController ✅
7. MemberController ✅
8. CoachController ✅
9. DashboardController ✅
10. BaseballRecordController ✅
11. DatabaseCheckController ❌ (사용 안 함)

### ⚠️ 프론트엔드에서 호출하지만 백엔드 미구현
- AnnouncementController (필요)
- MessageController (필요)
- AnalyticsController (필요)
- LessonController (필요)

### ❌ 모델은 있지만 컨트롤러 없음
- User (인증 구현 시 사용 예정)
- Setting (설정 기능 미사용)
- FacilitySlot (시설 슬롯 기능 미사용)

---

## 🎯 권장 조치 사항

### 즉시 삭제 가능
1. ✅ **DatabaseCheckController** - 개발용, 프론트엔드에서 호출 안 함
2. ✅ **일회성 SQL 스크립트 파일들** - 이미 실행 완료된 스크립트
3. ✅ **일회성 문서 파일들** - ngrok 가이드, 삭제 가이드 등

### 구현 필요 (프론트엔드 호출 중)
1. ⚠️ **AnnouncementController** - 공지사항 기능
2. ⚠️ **MessageController** - 메시지 발송 기능
3. ⚠️ **AnalyticsController** 또는 DashboardController 확장 - 통계 기능
4. ⚠️ **LessonController** - 레슨 관리 기능

### 보관 권장 (향후 사용 예정)
1. ✅ **User 모델/Repository** - 인증/인가 구현 시 필요
2. ✅ **Setting 모델/Repository** - 설정 기능 구현 시 필요

### 삭제 고려 (사용 계획 없음)
1. ❓ **FacilitySlot 모델/Repository** - 사용 계획이 없으면 삭제 가능

---

## 📝 정리 체크리스트

### 삭제 가능 항목
- [ ] `DatabaseCheckController.java`
- [ ] `check-member-id-sequence.sql`
- [ ] `fix-member-id-sequence.sql`
- [ ] `check_new_columns.sql`
- [ ] `reset-member-id.sql`
- [ ] `ngrok-사용법.md`
- [ ] `delete-member-data-guide.md`

### 구현 필요 항목
- [ ] `AnnouncementController.java`
- [ ] `MessageController.java`
- [ ] `AnalyticsController.java` 또는 DashboardController 확장
- [ ] `LessonController.java`

### 보관 항목
- [x] `User.java` 및 `UserRepository.java` (인증 구현 시 필요)
- [x] `Setting.java` 및 `SettingRepository.java` (설정 기능 구현 시 필요)

---

## 결론

**불필요한 코드 비율**: 약 15-20%

- **즉시 삭제 가능**: DatabaseCheckController, 일회성 SQL/문서 파일들
- **구현 필요**: AnnouncementController, MessageController, AnalyticsController, LessonController
- **보관 권장**: User, Setting (향후 사용 예정)

프로젝트는 대부분 필요한 코드로 구성되어 있으며, 일부 미구현 기능과 개발용 코드만 정리하면 됩니다.
