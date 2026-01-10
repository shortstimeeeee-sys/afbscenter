# AFBS 스포츠 운영 센터

웹 기반 야구 기록 관리 시스템입니다. 회원 관리 및 야구 기록을 관리하고 분석할 수 있습니다.

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
│   ├── MemberController.java
│   ├── BaseballRecordController.java
│   └── WebController.java
├── model/                        # JPA 엔티티
│   ├── Member.java              # 회원
│   └── BaseballRecord.java      # 야구 기록
├── repository/                   # JPA Repository
│   ├── MemberRepository.java
│   └── BaseballRecordRepository.java
└── service/                      # 비즈니스 로직
    ├── MemberService.java
    └── BaseballRecordService.java

src/main/resources/
├── application.properties        # 설정 파일
└── static/                       # 정적 리소스
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## 기능

- **회원 관리**: 회원 등록, 수정, 삭제, 검색
- **야구 기록 관리**: 타격 기록, 투구 기록 관리
- **기록 분석**: 타율, 방어율 등 통계 계산

## 실행 방법

### 1. 환경 요구사항

- Java 17 이상
- Maven 3.6 이상

### 2. 실행

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

### 3. 접속

- **웹 애플리케이션**: http://localhost:8080
- **H2 콘솔**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/afbscenter`
  - Username: `sa`
  - Password: (비어있음)

## API 엔드포인트

### 회원 관리
- `GET /api/members` - 전체 회원 조회
- `GET /api/members/{id}` - 회원 상세 조회
- `POST /api/members` - 회원 등록
- `PUT /api/members/{id}` - 회원 수정
- `DELETE /api/members/{id}` - 회원 삭제
- `GET /api/members/search?name={name}` - 회원 검색

### 야구 기록 관리
- `GET /api/baseball-records/member/{memberId}` - 회원별 기록 조회
- `GET /api/baseball-records/{id}` - 기록 상세 조회
- `POST /api/baseball-records/member/{memberId}` - 기록 등록
- `PUT /api/baseball-records/{id}` - 기록 수정
- `DELETE /api/baseball-records/{id}` - 기록 삭제
- `GET /api/baseball-records/date-range?startDate={date}&endDate={date}` - 기간별 기록 조회
- `GET /api/baseball-records/member/{memberId}/average-batting` - 평균 타율 조회

## 데이터베이스

H2 파일 데이터베이스를 사용하며, 데이터는 `./data/afbscenter.mv.db` 파일에 저장됩니다.

## 개발 환경 설정

자세한 설치 가이드는 `SETUP_GUIDE.md`를 참고하세요.

## 빌드

```powershell
mvn clean package
```

빌드된 JAR 파일은 `target/afbscenter-1.0.0.jar`에 생성됩니다.

## 라이선스

이 프로젝트는 개인 사용 목적으로 개발되었습니다.
