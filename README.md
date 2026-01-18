# AFBS 스포츠 운영 센터

웹 기반 야구 센터 관리 시스템입니다. 회원 관리, 예약 관리, 결제, 출석, 코치 관리, 훈련 기록 등을 통합 관리할 수 있습니다.

## 기술 스택

- **Java 17**: 프로그래밍 언어
- **Spring Boot 3.2.0**: 백엔드 프레임워크
- **Spring Data JPA**: 데이터베이스 접근 계층
- **H2 Database**: 로컬 파일 기반 데이터베이스
- **Maven**: 빌드 도구
- **HTML/CSS/JavaScript**: 프론트엔드

## 프로젝트 구조

```
src/main/java/com/afbscenter/
├── AfbsCenterApplication.java    # Spring Boot 메인 클래스
├── controller/                   # REST API 컨트롤러
│   ├── AttendanceController.java
│   ├── BaseballRecordController.java
│   ├── BookingController.java
│   ├── CoachController.java
│   ├── DashboardController.java
│   ├── FacilityController.java
│   ├── MemberController.java
│   ├── PaymentController.java
│   ├── ProductController.java
│   └── TrainingLogController.java
├── model/                        # JPA 엔티티
│   ├── Attendance.java
│   ├── BaseballRecord.java
│   ├── Booking.java
│   ├── Coach.java
│   ├── Facility.java
│   ├── LessonCategory.java
│   ├── Member.java
│   ├── MemberProduct.java
│   ├── Payment.java
│   ├── Product.java
│   └── TrainingLog.java
├── repository/                   # JPA Repository
│   └── (각 엔티티별 Repository)
├── service/                      # 비즈니스 로직
│   ├── BaseballRecordService.java
│   ├── CoachService.java
│   └── MemberService.java
└── util/                         # 유틸리티
    └── LessonCategoryUtil.java

src/main/resources/
├── application.properties        # 설정 파일
└── static/                       # 정적 리소스
    ├── index.html               # 대시보드
    ├── members.html             # 회원 관리
    ├── bookings.html            # 예약 관리
    ├── payments.html            # 결제 관리
    ├── facilities.html          # 시설 관리
    ├── products.html            # 상품 관리
    ├── attendance.html          # 출석 관리
    ├── coaches.html             # 코치 관리
    ├── training-logs.html       # 훈련 기록
    ├── analytics.html           # 통계/분석
    ├── announcements.html       # 공지사항
    ├── settings.html            # 설정
    ├── css/                     # 스타일시트
    └── js/                      # JavaScript
```

## 주요 기능

- **회원 관리**: 회원 등록, 수정, 삭제, 검색, 등급 관리
- **예약 관리**: 시설 예약, 레슨 예약, 예약 상태 관리
- **결제 관리**: 결제 처리, 환불, 정산
- **시설 관리**: 시설 정보, 슬롯 관리, 운영시간 설정
- **상품 관리**: 이용권, 패키지 상품 관리
- **출석 관리**: 체크인/체크아웃, 출석 기록
- **코치 관리**: 코치 정보, 레슨 일정 관리
- **훈련 기록**: 타격 기록, 투구 기록, 체력 기록
- **통계/분석**: 운영 지표, 매출 분석, 회원 분석
- **야구 기록**: 타격 기록, 투구 기록 관리 및 분석

## 실행 방법

### 1. 환경 요구사항

- Java 17 이상
- Maven 3.6 이상

### 2. 실행

#### 방법 1: PowerShell 스크립트 (권장)
```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

#### 방법 2: GUI 제어판 사용
바탕화면의 "Server Control Panel" 바로가기를 더블클릭

#### 방법 3: Maven 직접 실행
```powershell
mvn spring-boot:run
```

### 3. 접속

- **웹 애플리케이션**: http://localhost:8080
- **H2 콘솔**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/afbscenter`
  - Username: `sa`
  - Password: (비어있음)

## 서버 관리

### GUI 제어판
- 바탕화면의 "Server Control Panel" 바로가기 사용
- 서버 시작/중지/재시작, 브라우저 열기 기능 제공

### 명령어
```powershell
# 서버 시작
.\start-server.ps1

# 서버 중지
.\stop-server.ps1

# 서버 재시작
.\restart-server.ps1
```

## API 엔드포인트

### 회원 관리 (`/api/members`)
- `GET /api/members` - 전체 회원 조회
- `GET /api/members/{id}` - 회원 상세 조회
- `POST /api/members` - 회원 등록
- `PUT /api/members/{id}` - 회원 수정
- `DELETE /api/members/{id}` - 회원 삭제
- `GET /api/members/search?name={name}` - 회원 검색

### 예약 관리 (`/api/bookings`)
- `GET /api/bookings` - 예약 목록 조회
- `GET /api/bookings/{id}` - 예약 상세 조회
- `POST /api/bookings` - 예약 등록
- `PUT /api/bookings/{id}` - 예약 수정
- `DELETE /api/bookings/{id}` - 예약 삭제

### 결제 관리 (`/api/payments`)
- `GET /api/payments` - 결제 목록 조회
- `POST /api/payments` - 결제 처리
- `POST /api/payments/{id}/refund` - 환불 처리

### 시설 관리 (`/api/facilities`)
- `GET /api/facilities` - 시설 목록 조회
- `POST /api/facilities` - 시설 등록
- `PUT /api/facilities/{id}` - 시설 수정
- `DELETE /api/facilities/{id}` - 시설 삭제

### 상품 관리 (`/api/products`)
- `GET /api/products` - 상품 목록 조회
- `POST /api/products` - 상품 등록
- `PUT /api/products/{id}` - 상품 수정
- `DELETE /api/products/{id}` - 상품 삭제

### 야구 기록 관리 (`/api/baseball-records`)
- `GET /api/baseball-records/member/{memberId}` - 회원별 기록 조회
- `GET /api/baseball-records/{id}` - 기록 상세 조회
- `POST /api/baseball-records/member/{memberId}` - 기록 등록
- `PUT /api/baseball-records/{id}` - 기록 수정
- `DELETE /api/baseball-records/{id}` - 기록 삭제
- `GET /api/baseball-records/member/{memberId}/average-batting` - 평균 타율 조회

자세한 API 문서는 `PROJECT_STRUCTURE.md`를 참고하세요.

## 데이터베이스

H2 파일 데이터베이스를 사용하며, 데이터는 `./data/afbscenter.mv.db` 파일에 저장됩니다.

## 개발 환경 설정

자세한 설치 가이드는 `SETUP_GUIDE.md`를 참고하세요.

## 배포

배포 가이드는 `DEPLOYMENT_GUIDE.md`를 참고하세요.
빠른 시작은 `QUICK_START.md`를 참고하세요.

## 빌드

```powershell
mvn clean package
```

빌드된 JAR 파일은 `target/afbscenter-1.0.0.jar`에 생성됩니다.

## 라이선스

이 프로젝트는 개인 사용 목적으로 개발되었습니다.
