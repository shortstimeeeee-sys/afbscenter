# 노트북 필수 설치 (AFBS Center)

노트북에서 이 프로젝트를 실행하려면 **Java 17**과 **Maven**이 필요합니다.

---

## 1. 자동 설치 (권장)

PowerShell을 **관리자 권한 없이** 열고, 프로젝트 폴더에서 실행하세요.

```powershell
cd C:\Users\본인사용자명\Desktop\afbscenter
powershell -ExecutionPolicy Bypass -File .\setup-laptop.ps1
```

- **Java 17**이 없으면 winget으로 설치합니다. (Windows 10/11에 winget 포함)
- **Maven**이 없으면 사용자 폴더에 다운로드해 설치합니다.
- Java 설치 후에는 **PowerShell을 닫았다가 다시 연 다음**, 같은 명령을 한 번 더 실행하면 Maven까지 설치됩니다.

---

## 2. 설치 확인

새 PowerShell 창에서:

```powershell
java -version
mvn -version
```

- `java -version` → `"17.x.x"` 로 나오면 OK  
- `mvn -version` → `Apache Maven 3.x.x` 로 나오면 OK  

---

## 3. 수동 설치 (자동 설치가 안 될 때)

자세한 방법은 **SETUP_GUIDE.md** 를 보세요.

| 항목   | 요구사항        | 다운로드 |
|--------|-----------------|----------|
| Java   | **Java 17** 이상 | https://adoptium.net/temurin/releases/ (Version 17, Windows x64) |
| Maven  | **Maven 3.6** 이상 | https://maven.apache.org/download.cgi |

설치 후:

1. **JAVA_HOME** = Java 설치 경로 (예: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`)
2. **MAVEN_HOME** = Maven 압축 해제 경로 (예: `C:\Program Files\Apache\maven\apache-maven-3.9.x`)
3. **Path**에 `%JAVA_HOME%\bin`, `%MAVEN_HOME%\bin` 추가
4. **모든 창을 닫고 새 터미널**을 연 뒤 `java -version`, `mvn -version` 확인

---

## 4. 서버 실행

필수 설치가 끝났으면:

```powershell
.\run.ps1
```

브라우저에서 **http://localhost:8080** 으로 접속하면 됩니다.
