# 하드코딩된 값 분석 보고서

## 📋 개요
프로젝트 전체에서 하드코딩된 값들을 검색하여 정리한 보고서입니다.

---

## 🔴 심각도: 높음 (설정 파일로 분리 권장)

### 1. **SettingsController - 기본 설정값들**
**위치**: `src/main/java/com/afbscenter/controller/SettingsController.java`

#### `createAndSaveDefaultSettings()` 메서드 (208-236줄)
```java
settings.setCenterName("AFBS 야구센터");              // 하드코딩
settings.setPhoneNumber("02-1234-5678");             // 하드코딩
settings.setAddress("서울특별시 강남구");              // 하드코딩
settings.setOpenTime(LocalTime.of(9, 0));            // 하드코딩: 오픈 9시
settings.setCloseTime(LocalTime.of(22, 0));          // 하드코딩: 마감 22시
settings.setHolidayInfo("연중무휴");                   // 하드코딩
settings.setDefaultSessionDuration(60);               // 하드코딩: 60분
settings.setMaxAdvanceBookingDays(30);                // 하드코딩: 30일
settings.setCancellationDeadlineHours(24);            // 하드코딩: 24시간
settings.setTaxRate(10.0);                            // 하드코딩: 10%
settings.setRefundPolicy("예약 24시간 전까지 전액 환불"); // 하드코딩
settings.setReminderHours(24);                         // 하드코딩: 24시간
```

#### `createTempSettings()` 메서드 (239-259줄)
- 동일한 값들이 중복으로 하드코딩됨

**권장 조치**: `application.properties` 또는 별도 설정 파일로 분리

---

### 2. **결제 관련 하드코딩**
**위치**: 여러 컨트롤러 파일

#### PaymentMethod 하드코딩 (5곳)
```java
payment.setPaymentMethod(Payment.PaymentMethod.CASH); // 기본값: 현금
```
- `MemberController.java`: 936, 2002, 2400줄
- `MemberProductController.java`: 384줄
- `DatabaseMigration.java`: 519줄

**권장 조치**: 설정 파일에서 기본 결제 방법 지정

#### PaymentStatus 하드코딩
```java
payment.setStatus(Payment.PaymentStatus.COMPLETED);
```
- 여러 곳에서 `COMPLETED` 상태가 하드코딩됨

---

### 3. **기본값 숫자 하드코딩**

#### `totalCount = 10` (기본값)
**위치**: 여러 파일
- `MemberController.java`: 438, 1772줄
- `MemberProductController.java`: 276, 365, 555, 641, 745, 852줄
- `DashboardController.java`: 292, 388줄
- `MemberService.java`: 472줄

#### `usageCount = 10` (기본값)
**위치**:
- `MemberController.java`: 665줄

#### 예약 시간 기본값 `60분`
**위치**: `AnalyticsController.java`
```java
minutes = 60; // 기본값 1시간
totalBookedMinutes += 60; // 기본값 1시간
```

#### 운영 시간 기본값 `24시간`
**위치**: `AnalyticsController.java`
```java
// 운영 시간이 설정되지 않은 경우, 기본값으로 24시간 사용
```

---

## 🟡 심각도: 중간 (상수 클래스로 분리 권장)

### 4. **시설 초기화 하드코딩**
**위치**: `src/main/java/com/afbscenter/config/DatabaseMigration.java`

```java
// 사하점
sahaFacility.setName("사하점");
sahaFacility.setLocation("부산");
sahaFacility.setHourlyRate(0);
sahaFacility.setOpenTime(LocalTime.of(8, 0));
sahaFacility.setCloseTime(LocalTime.of(0, 0));

// 연산점
yeonsanFacility.setName("연산점");
yeonsanFacility.setLocation("부산");
yeonsanFacility.setHourlyRate(0);
yeonsanFacility.setOpenTime(LocalTime.of(8, 0));
yeonsanFacility.setCloseTime(LocalTime.of(0, 0));
```

**권장 조치**: 초기 데이터는 SQL 스크립트나 별도 설정 파일로 분리

---

### 5. **모델 기본값 하드코딩**

#### Facility 모델
```java
private Branch branch = Branch.SAHA; // 기본값: 사하점
private FacilityType facilityType = FacilityType.BASEBALL; // 기본값: 야구
```

#### Booking 모델
```java
private Branch branch = Branch.SAHA; // 기본값: 사하점
```

#### Payment 모델
```java
private PaymentStatus status = PaymentStatus.COMPLETED;
private Integer refundAmount = 0; // 기본값 (이미 @PrePersist로 처리됨)
```

---

## 🟢 심각도: 낮음 (현재 상태 유지 가능)

### 6. **전화번호 기본값**
**위치**: `MemberService.java`
```java
// 전화번호가 없으면 기본값 사용 (00000000)
```

### 7. **에러 처리 깊이 제한**
**위치**: `MemberController.java`
```java
int depth = 0;
while (cause != null && depth < 5) { // 최대 5단계까지만
```

### 8. **날짜 범위 계산**
**위치**: `MemberController.java`
```java
LocalDateTime startDate = purchaseDate.minusDays(7);  // 7일 전
LocalDateTime endDate = purchaseDate.plusDays(7);     // 7일 후
```

---

## 📝 권장 개선 사항

### 1. **설정 파일 분리**
`application.properties` 또는 `application-defaults.properties` 파일 생성:
```properties
# 센터 기본 정보
center.default.name=AFBS 야구센터
center.default.phone=02-1234-5678
center.default.address=서울특별시 강남구

# 운영 시간
center.default.open-time=09:00
center.default.close-time=22:00

# 예약 설정
booking.default.session-duration=60
booking.max-advance-days=30
booking.cancellation-deadline-hours=24

# 결제 설정
payment.default.method=CASH
payment.default.tax-rate=10.0
payment.refund-policy=예약 24시간 전까지 전액 환불

# 알림 설정
notification.reminder-hours=24

# 상품 기본값
product.default.total-count=10
product.default.usage-count=10
```

### 2. **상수 클래스 생성**
`src/main/java/com/afbscenter/constants/DefaultValues.java`:
```java
public class DefaultValues {
    public static final int DEFAULT_TOTAL_COUNT = 10;
    public static final int DEFAULT_USAGE_COUNT = 10;
    public static final int DEFAULT_SESSION_DURATION = 60;
    public static final int DEFAULT_BOOKING_MINUTES = 60;
    public static final int DEFAULT_OPERATING_HOURS = 24;
    // ...
}
```

### 3. **@Value 어노테이션 활용**
```java
@Value("${product.default.total-count:10}")
private int defaultTotalCount;
```

---

## 📊 통계

- **총 하드코딩 발견**: 약 50+ 곳
- **심각도 높음**: 15곳 (설정 파일로 분리 필요)
- **심각도 중간**: 20곳 (상수 클래스로 분리 권장)
- **심각도 낮음**: 15곳 (현재 상태 유지 가능)

---

## ✅ 이미 개선된 부분

1. ✅ `Payment.refundAmount` - `@PrePersist`로 자동 처리 (하드코딩 제거됨)
2. ✅ `Payment.status` - 모델 기본값으로 처리

---

## 🔧 즉시 수정 권장 항목

1. **SettingsController의 기본 설정값들** → `application.properties`로 이동
2. **결제 방법 기본값** → 설정 파일로 이동
3. **totalCount/usageCount 기본값 10** → 상수 클래스로 분리
4. **시설 초기화 데이터** → SQL 스크립트 또는 설정 파일로 분리
