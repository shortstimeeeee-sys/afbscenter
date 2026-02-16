# 노트북 ↔ 데스크탑 동기화 가이드

---

## 한 번에 완전 싱크 (노트북 최신 → 데스크탑 덮어쓰기)

노트북이 최신이고 데스크탑을 그대로 맞추고 싶을 때: **코드 + DB(data 폴더)** 통째로 덮어쓰기. 데스크탑 현재 내용은 자동으로 백업됩니다.

### 1단계: 노트북에서 (최신 상태인 PC)

1. PowerShell에서 프로젝트 폴더로 이동 후 실행:
   ```powershell
   cd C:\Users\본인\Desktop\afbscenter
   .\sync-pack-on-laptop.ps1
   ```
2. **바탕화면**에 `afbscenter-sync-pack-날짜시간.zip` 파일이 생성됩니다.
3. 이 zip 파일을 USB, OneDrive, 이메일 등으로 **데스크탑**으로 복사합니다.

### 2단계: 데스크탑에서

1. (선택) 혹시 모르니 **수동 백업**까지 하고 싶다면:
   ```powershell
   cd C:\Users\본인\Desktop\afbscenter
   .\sync-backup-desktop.ps1
   ```
   → 바탕화면에 `afbscenter-backup-날짜시간` 폴더가 생깁니다.

2. 노트북에서 복사한 zip을 데스크탑의 **바탕화면**에 넣거나, 프로젝트 폴더에 넣습니다.

3. PowerShell에서:
   ```powershell
   cd C:\Users\본인\Desktop\afbscenter
   .\sync-restore-from-pack.ps1
   ```
   - zip이 바탕화면에 있으면:  
     `.\sync-restore-from-pack.ps1 -ZipPath "C:\Users\본인\Desktop\afbscenter-sync-pack-xxxx.zip"`
   - 스크립트가 **현재 프로젝트를 자동 백업**한 뒤, zip 내용으로 덮어쓰기 합니다.

4. 끝. 데스크탑이 노트북과 동일한 코드 + DB 상태가 됩니다.

| 스크립트 | 용도 |
|----------|------|
| `sync-pack-on-laptop.ps1` | 노트북: 최신 상태를 zip으로 생성 (코드+data) |
| `sync-backup-desktop.ps1` | 데스크탑: 지금 상태를 폴더로 백업 (복사용 보관) |
| `sync-restore-from-pack.ps1` | 데스크탑: zip 받은 뒤 백업 후 덮어쓰기 (완전 싱크) |

---

## 평소 동기화: Git + GitHub (코드만, 매번 파일 안 옮기기)

코드와 설정만 두 PC에서 맞추려면 **Git + 원격 저장소**를 쓰는 것이 좋습니다.

### 노트북에서 한 번 올리기 (스크립트)

1. **GitHub에서 저장소 생성**: https://github.com/new → 이름 `afbscenter` → Create repository (Private 가능)
2. **노트북** 프로젝트 폴더에서 PowerShell 실행:
   ```powershell
   cd C:\Users\본인\Desktop\afbscenter
   .\git-upload.ps1 -RepoUrl "https://github.com/본인아이디/afbscenter.git"
   ```
   (본인아이디를 자신의 GitHub 아이디로 바꾸세요.)
3. 끝. 이제 데스크탑에서는 `git pull` 로 맞출 수 있습니다.

| 스크립트 | 용도 |
|----------|------|
| `git-upload.ps1` | 노트북(또는 현재 PC)에서 GitHub에 최초 업로드 / 이후 push |

---

## 1. Git + GitHub (또는 GitLab) 사용 (권장)

### 한 번만 할 작업

**1) GitHub 계정**
- https://github.com 에서 가입 (무료)

**2) 원격 저장소 만들기**
- GitHub에서 **New repository** → 이름 예: `afbscenter` → Create
- **코드는 이미 있으므로** "push an existing repository" 안내를 따라 아래를 실행

**3) 프로젝트 폴더에서 (데스크탑 또는 노트북 중 한쪽에서)**

```powershell
cd C:\Users\본인\Desktop\afbscenter
git init
git add .
git commit -m "초기 커밋"
git branch -M main
git remote add origin https://github.com/본인아이디/afbscenter.git
git push -u origin main
```

**4) 다른 PC(노트북 또는 데스크탑)에서**

- 같은 폴더가 없다면: `git clone https://github.com/본인아이디/afbscenter.git` 로 받기
- 이미 폴더가 있다면: 그 폴더에서 `git remote add origin https://github.com/본인아이디/afbscenter.git` 후 `git pull origin main`

---

### 매일 쓰는 방법 (동기화)

**작업 끝난 PC에서 (변경사항 올리기)**

```powershell
cd C:\Users\본인\Desktop\afbscenter
git add .
git commit -m "노트북에서 수정한 내용"   # 또는 "데스크탑에서 수정"
git push
```

**다른 PC에서 (최신 내용 받기)**

```powershell
cd C:\Users\본인\Desktop\afbscenter
git pull
```

- **먼저 pull 받은 다음** 작업하고, 끝나면 **commit + push** 하면 됩니다.
- 두 PC에서 같은 파일을 동시에 수정하면 **충돌(conflict)** 이 날 수 있으므로, 가능하면 한 PC에서만 수정하고 push → 다른 PC에서 pull 하는 흐름이 안전합니다.

---

## 2. 중요한 점: DB(데이터)는 Git에 안 올라갑니다

- `data/` 폴더(H2 DB: 회원, 예약, 결제 등)는 **.gitignore에 있어서** 원격 저장소에 올라가지 않습니다.
- 그래서 **코드·설정**만 노트북↔데스크탑이 맞고, **실제 운영 데이터**는 PC마다 따로입니다.

**선택지:**

| 방법 | 설명 |
|------|------|
| **그대로 사용** | 노트북은 노트북용 데이터, 데스크탑은 데스크탑용 데이터로 각각 사용. 코드만 sync. |
| **DB 파일만 수동 복사** | 중요한 쪽에서 `data/` 폴더 전체를 USB 등으로 복사해 다른 PC의 `data/` 를 덮어쓰기. (서버 끈 상태에서만) |
| **나중에 DB도 공유** | 실제 서버(또는 클라우드 DB) 하나 두고, 두 PC 모두 그 DB를 쓰도록 설정 변경. (별도 작업 필요) |

지금은 **코드 동기화 = Git push/pull**, **데이터 = 각 PC 로컬 또는 수동 복사**로 가져가면 됩니다.

---

## 3. 요약

- **코드/설정 맞추기:** Git + GitHub 쓰고, 한쪽에서 `git add .` → `git commit` → `git push`, 다른 쪽에서 `git pull`.
- **매번 파일 옮기기:** 필요 없음. push/pull 만 하면 됩니다.
- **데이터(회원·예약 등):** Git으로는 안 맞춰지므로, 필요하면 `data/` 폴더만 따로 백업/복사하거나, 나중에 공용 DB를 쓰는 방식으로 확장하면 됩니다.
