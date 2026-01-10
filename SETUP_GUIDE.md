# 개발 환경 설정 가이드

## 1. Java 설치

### 1-1. Java 다운로드

프로젝트는 **Java 17** 이상이 필요합니다.

1. **Oracle JDK 또는 OpenJDK 다운로드**
   - **Eclipse Temurin (권장)**: https://adoptium.net/temurin/releases/
     - Version: 17 (LTS)
     - Operating System: Windows
     - Architecture: x64
     - Package Type: JDK
   
   또는
   
   - **Oracle JDK**: https://www.oracle.com/java/technologies/downloads/#java17
     - Windows x64 Installer 다운로드

### 1-2. Java 설치

1. 다운로드한 설치 파일 실행
2. 설치 마법사 따라하기
3. 설치 경로 확인 (기본 경로: `C:\Program Files\Java\jdk-17` 또는 `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`)

### 1-3. 환경 변수 설정

#### 방법 1: 자동 설정 (설치 시 옵션 선택)
- 설치 시 "Set JAVA_HOME variable" 옵션이 있으면 체크

#### 방법 2: 수동 설정

1. **시스템 환경 변수 열기**
   - Windows 키 + R → `sysdm.cpl` 입력 → Enter
   - 또는: 제어판 → 시스템 → 고급 시스템 설정

2. **JAVA_HOME 설정**
   - "환경 변수" 버튼 클릭
   - "시스템 변수" 섹션에서 "새로 만들기" 클릭
   - 변수 이름: `JAVA_HOME`
   - 변수 값: Java 설치 경로 (예: `C:\Program Files\Eclipse Adoptium\jdk-17.0.9+9-hotspot`)
   - 확인 클릭

3. **PATH 설정**
   - "시스템 변수"에서 `Path` 선택 → "편집" 클릭
   - "새로 만들기" 클릭
   - `%JAVA_HOME%\bin` 추가
   - 확인 클릭

4. **변경사항 적용**
   - 모든 창 닫기
   - **새 터미널/PowerShell 창 열기** (중요!)

### 1-4. 설치 확인

새 터미널에서 다음 명령어 실행:

```bash
java -version
javac -version
```

예상 출력:
```
openjdk version "17.0.x" 2023-xx-xx
OpenJDK Runtime Environment Temurin-17.0.x+8 (build 17.0.x+8)
OpenJDK 64-Bit Server VM Temurin-17.0.x+8 (build 17.0.x+8, mixed mode, sharing)
```

---

## 2. Maven 설치

### 2-1. Maven 다운로드

1. **Apache Maven 다운로드**
   - https://maven.apache.org/download.cgi
   - `apache-maven-3.9.x-bin.zip` 다운로드 (최신 버전)

### 2-2. Maven 설치

1. 압축 해제
   - 원하는 위치에 압축 해제 (예: `C:\Program Files\Apache\maven`)

2. **환경 변수 설정**
   - `MAVEN_HOME` 변수 생성
     - 변수 이름: `MAVEN_HOME`
     - 변수 값: Maven 설치 경로 (예: `C:\Program Files\Apache\maven\apache-maven-3.9.5`)
   - `Path`에 추가
     - `%MAVEN_HOME%\bin` 추가

3. **변경사항 적용**
   - 모든 창 닫기
   - **새 터미널/PowerShell 창 열기**

### 2-3. 설치 확인

```bash
mvn -version
```

예상 출력:
```
Apache Maven 3.9.x
Maven home: C:\Program Files\Apache\maven\apache-maven-3.9.x
Java version: 17.0.x, vendor: Eclipse Adoptium
```

---

## 3. IDE 설정 (선택사항)

### IntelliJ IDEA (권장)

1. **다운로드**
   - https://www.jetbrains.com/idea/download/
   - Community Edition (무료) 다운로드

2. **프로젝트 열기**
   - File → Open → 프로젝트 폴더 선택
   - Maven 프로젝트로 자동 인식

3. **JDK 설정**
   - File → Project Structure → Project
   - Project SDK: Java 17 선택

### Eclipse

1. **다운로드**
   - https://www.eclipse.org/downloads/
   - Eclipse IDE for Enterprise Java and Web Developers

2. **프로젝트 가져오기**
   - File → Import → Maven → Existing Maven Projects

### VS Code

1. **확장 프로그램 설치**
   - Extension Pack for Java (Microsoft)
   - Maven for Java (Microsoft)

---

## 4. 프로젝트 실행

### 명령어로 실행

```bash
# 프로젝트 디렉토리로 이동
cd C:\Users\dlfgi\OneDrive\Desktop\afbscenter

# Maven 빌드
mvn clean install

# 애플리케이션 실행
mvn spring-boot:run
```

### IDE에서 실행

1. `AfbsCenterApplication.java` 파일 열기
2. Run 버튼 클릭 또는 Shift+F10

---

## 5. 문제 해결

### Java가 인식되지 않는 경우
- 환경 변수 설정 후 **새 터미널**을 열었는지 확인
- `echo %JAVA_HOME%` 명령어로 경로 확인
- Java 설치 경로가 올바른지 확인

### Maven이 인식되지 않는 경우
- 환경 변수 설정 후 **새 터미널**을 열었는지 확인
- `echo %MAVEN_HOME%` 명령어로 경로 확인
- Maven 설치 경로가 올바른지 확인

### 빌드 오류가 발생하는 경우
- Java 버전 확인: `java -version` (17 이상 필요)
- Maven 버전 확인: `mvn -version`
- 프로젝트 디렉토리에서 실행 중인지 확인

---

## 다음 단계

Java 설치가 완료되면 알려주세요. 다음 단계로 진행하겠습니다!
