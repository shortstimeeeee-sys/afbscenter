# ngrok 링크 확인 방법

## 📍 링크 확인 위치

### 방법 1: 터미널에서 확인 (가장 간단)

1. **ngrok 실행**
   ```powershell
   .\ngrok.exe http 8080
   ```

2. **터미널 화면 확인**
   
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
                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                 이 부분이 공유할 링크입니다!
   
   Connections                   ttl     opn     rt1     rt5     p50     p90
                                 0       0       0.00    0.00    0.00    0.00
   ```

3. **링크 복사**
   - `Forwarding` 줄에서 `https://`로 시작하는 부분을 복사
   - 예: `https://abc123-def456.ngrok-free.app`

---

### 방법 2: 웹 인터페이스에서 확인

1. **ngrok 실행 중에 브라우저 열기**
   - 주소: `http://127.0.0.1:4040`
   - 또는 터미널에 표시된 `Web Interface` 주소 클릭

2. **ngrok 웹 인터페이스 확인**
   - 상단에 "Forwarding" 섹션에 링크 표시
   - 요청 로그도 실시간으로 확인 가능

---

## 🎯 실제 사용 예시

### 단계별 화면

**1단계: ngrok 실행**
```powershell
PS C:\Users\dlfgi\OneDrive\Desktop\afbscenter> .\ngrok.exe http 8080
```

**2단계: 터미널 화면 (링크 확인)**
```
ngrok

Session Status                online
Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:8080
                                 ↑
                            이 링크를 복사하세요!
```

**3단계: 링크 공유**
- 복사한 링크: `https://abc123-def456.ngrok-free.app`
- 이 링크를 다른 사람에게 전달
- 다른 사람이 브라우저에 입력하면 바로 접속 가능!

---

## ⚠️ 주의사항

1. **링크는 매번 변경됨**
   - ngrok을 다시 실행하면 새로운 링크 생성
   - 무료 플랜은 고정 링크 불가

2. **서버가 실행 중이어야 함**
   - `.\run.ps1`로 서버가 실행 중이어야 링크가 작동
   - 서버를 종료하면 링크도 작동하지 않음

3. **세션 시간 제한**
   - 무료 플랜: 2시간마다 세션 만료
   - 만료되면 ngrok을 다시 실행해야 함

---

## 🔍 문제 해결

### 링크가 보이지 않을 때
- ngrok이 정상적으로 실행되었는지 확인
- `Session Status`가 `online`인지 확인
- 오류 메시지가 있는지 확인

### 링크가 작동하지 않을 때
- 서버가 실행 중인지 확인 (`http://localhost:8080` 접속 테스트)
- ngrok이 정상적으로 실행 중인지 확인
- 방화벽 설정 확인

---

## 💡 팁

- **링크를 메모장에 복사해두기**: 매번 확인하기 번거로우니 복사해두세요
- **웹 인터페이스 활용**: `http://127.0.0.1:4040`에서 요청 로그 확인 가능
- **모바일에서도 접속 가능**: 생성된 링크는 모바일 브라우저에서도 작동
