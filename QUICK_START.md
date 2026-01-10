# 빠른 시작 가이드 (3단계로 다른 사람과 공유하기)

## ⚡ 가장 빠른 방법: ngrok 사용 (약 5분)

### 전체 과정 요약
1. ngrok 설치 (1분)
2. 서버 실행 (1분)
3. ngrok 터널 생성 → 링크 생성 완료! (1분)

---

## 📋 단계별 가이드

### 1단계: ngrok 설치

**방법 A: 공식 사이트에서 다운로드 (추천)**
1. https://ngrok.com/download 접속
2. Windows용 다운로드
3. 압축 해제 후 `ngrok.exe`를 프로젝트 폴더에 복사하거나 PATH에 추가

**방법 B: Chocolatey 사용 (이미 설치되어 있다면)**
```powershell
choco install ngrok
```

**방법 C: 직접 다운로드 (PowerShell) - Chocolatey 없이**
```powershell
# ngrok 다운로드 및 설치
$ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
Invoke-WebRequest -Uri $ngrokUrl -OutFile "ngrok.zip" -UseBasicParsing
Expand-Archive -Path "ngrok.zip" -DestinationPath "." -Force
Remove-Item "ngrok.zip"
```

**또는 이미 다운로드되어 있다면:**
- 프로젝트 폴더에 `ngrok.exe` 파일이 있는지 확인
- 있으면 바로 `.\ngrok.exe http 8080` 실행 가능

---

### 2단계: Spring Boot 서버 실행

**터미널 1 (서버 실행용)**
```powershell
# 프로젝트 폴더로 이동
cd C:\Users\dlfgi\OneDrive\Desktop\afbscenter

# 서버 실행
.\run.ps1
```

서버가 정상적으로 실행되면 다음과 같은 메시지가 표시됩니다:
```
Started AfbsCenterApplication in X.XXX seconds
```

**확인**: 브라우저에서 `http://localhost:8080` 접속하여 페이지가 보이는지 확인

---

### 3단계: ngrok 터널 생성 및 링크 공유

**터미널 2 (ngrok 실행용 - 새 터미널 열기)**

```powershell
# 프로젝트 폴더로 이동
cd C:\Users\dlfgi\OneDrive\Desktop\afbscenter

# ngrok 실행
.\ngrok.exe http 8080
```

또는 ngrok이 PATH에 있다면:
```powershell
ngrok http 8080
```

**결과 확인**

ngrok이 실행되면 다음과 같은 화면이 표시됩니다:

```
ngrok

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:8080

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**여기서 중요한 부분:**
```
Forwarding: https://abc123-def456.ngrok-free.app -> http://localhost:8080
```

**이 `https://abc123-def456.ngrok-free.app` 링크를 다른 사람에게 공유하세요!**

---

## 🎯 실제 사용 예시

### 시나리오: 친구에게 링크 공유하기

1. **본인 (서버 운영자)**
   - 서버 실행: `.\run.ps1`
   - ngrok 실행: `ngrok http 8080`
   - 생성된 링크 복사: `https://abc123-def456.ngrok-free.app`
   - 친구에게 링크 전송

2. **친구 (사용자)**
   - 받은 링크를 브라우저에 입력
   - 바로 접속 가능!

---

## ⚠️ 주의사항

### 무료 플랜 제한사항
- **세션 시간**: 2시간마다 만료 (재시작 필요)
- **링크 변경**: 매번 실행할 때마다 새로운 링크 생성
- **대역폭**: 월 1GB 제한

### 해결 방법
1. **세션 만료 시**: ngrok을 다시 실행하면 새로운 링크 생성
2. **고정 링크 필요 시**: 유료 플랜 구독 (월 $8부터)
3. **안정적 서비스 필요 시**: Railway, Heroku 등 클라우드 서비스 사용

---

## 🔧 문제 해결

### ngrok 실행 시 오류
```
ERROR:  You must sign up for an ngrok account and install your authtoken.
```

**해결 방법:**
1. https://ngrok.com/signup 에서 무료 계정 생성
2. 대시보드에서 authtoken 복사
3. PowerShell에서 실행:
   ```powershell
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```

### 포트가 이미 사용 중
```
ERROR: bind: address already in use
```

**해결 방법:**
```powershell
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :8080

# 프로세스 종료 (PID 번호 확인 후)
taskkill /PID [PID번호] /F
```

### 서버가 실행되지 않음
- Java가 설치되어 있는지 확인: `java -version`
- Maven이 설치되어 있는지 확인: `mvn -version`
- 포트 8080이 다른 프로그램에서 사용 중인지 확인

---

## 🚀 더 빠르게: 자동화 스크립트

프로젝트 폴더에 `start-with-ngrok.ps1` 파일을 만들면 한 번에 실행 가능:

```powershell
# start-with-ngrok.ps1
Write-Host "=== 서버 시작 중 ===" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\run.ps1"

Start-Sleep -Seconds 10

Write-Host "=== ngrok 터널 생성 중 ===" -ForegroundColor Green
.\ngrok.exe http 8080
```

사용법:
```powershell
.\start-with-ngrok.ps1
```

---

## 📱 모바일에서도 접속 가능

생성된 ngrok 링크는 모바일 브라우저에서도 접속 가능합니다!

예: `https://abc123-def456.ngrok-free.app`

---

## ✅ 체크리스트

배포 전 확인사항:
- [ ] 서버가 정상적으로 실행됨 (`http://localhost:8080` 접속 확인)
- [ ] ngrok이 정상적으로 실행됨 (링크 생성 확인)
- [ ] 다른 사람이 링크로 접속 가능한지 테스트
- [ ] 데이터베이스에 중요한 데이터가 있다면 백업

---

## 💡 팁

1. **ngrok 웹 인터페이스**: `http://127.0.0.1:4040`에서 요청 로그 확인 가능
2. **고정 도메인**: 유료 플랜으로 고정 도메인 사용 가능
3. **HTTPS 자동 제공**: ngrok은 자동으로 HTTPS 인증서 제공

---

## 🎉 완료!

이제 다른 사람이 링크를 통해 여러분의 작업 페이지를 사용할 수 있습니다!

**다음 단계 (선택사항):**
- 안정적인 서비스가 필요하면 Railway나 Heroku로 배포
- 자세한 내용은 `DEPLOYMENT_GUIDE.md` 참고
