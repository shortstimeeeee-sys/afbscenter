# 컨트롤러 분리 복구 가이드

분리 후 문제 발생 시 아래 순서로 복구할 수 있습니다.

## 0. 진행 전 준비 (권장)

- **분리 작업 전에 반드시 커밋**해 두세요.  
  예: `git add -A && git commit -m "Before controller split: Dashboard, Attendance, MemberDetail"`
- 이렇게 해두면 `git reset --hard <해시>` 또는 `git checkout -- path` 만으로 **전부 되돌리기**가 가능합니다.

## 2. 이번 분리에서 추가·변경된 파일

### 추가된 컨트롤러

| 파일 | 설명 |
|------|------|
| `DashboardQueryController.java` | GET /api/dashboard/expiring-members, today-schedule, alerts, announcements ✅ |
| `AttendanceCheckController.java` | POST /api/attendance, POST /api/attendance/checkin, POST /api/attendance/checkout ✅ |
| `MemberDetailQueryController.java` | GET /api/members/{id}/ability-stats-context, /{memberId}/products, /bookings, /payments, /attendance, /product-history ✅ |

### 수정된 컨트롤러 (해당 메서드 제거됨)

| 파일 | 제거된 메서드 |
|------|----------------|
| `DashboardController.java` | getExpiringMembers, getTodaySchedule, getAlerts, getActiveAnnouncements, updateMissingLessonCategoriesForBookings ✅ |
| `AttendanceController.java` | createAttendance, processCheckin, processCheckout, decreaseCountPassUsage, saveProductHistory, convertLessonCategoryToName, matchesLessonCategory ✅ |
| `MemberDetailController.java` | gradeToLabel, levelToNum, rankFromList, rankAndTotal, getAbilityStatsContext, getMemberProducts, getMemberBookings, getMemberPayments, getMemberAttendance, getMemberProductHistory ✅ |

## 3. Git으로 전체 롤백

```bash
# 방법 A: 분리 작업 전 커밋이 있다면
git reset --hard <분리_전_커밋_해시>

# 방법 B: 컨트롤러 디렉터리만 되돌리기 (추가된 파일은 수동 삭제)
git checkout -- src/main/java/com/afbscenter/controller/
# 새로 만든 *QueryController.java, *CheckController.java 등은 삭제
```

## 4. 수동 롤백 (일부만 되돌리기)

- **새 컨트롤러만 제거**: 해당 `*Controller.java` 파일 삭제.
- **기존 컨트롤러 복구**: 이전 커밋에서 해당 파일의 “제거된 메서드” 블록을 다시 복사해 넣기.

---

*이 문서는 컨트롤러 분리 작업 시 함께 업데이트됩니다.*
