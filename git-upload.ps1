# ============================================================
# Git 원격 저장소에 올리기 (노트북에서 싱크용 - 한 번 실행)
# 1) GitHub에서 새 저장소 생성 (이름 예: afbscenter, Private 가능)
# 2) 아래처럼 RepoUrl 넣어서 실행
#
#   .\git-upload.ps1 -RepoUrl "https://github.com/본인아이디/afbscenter.git"
#
# ============================================================
param(
    [Parameter(Mandatory = $false)]
    [string]$RepoUrl = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# 1) git init if needed
if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    Write-Host "Initializing git..."
    git init
}

# 2) add & commit
git add .
$status = git status --short
if (-not $status) {
    Write-Host "No changes to commit. Already up to date."
} else {
    git commit -m "Sync: code and config (data/ not included)"
    Write-Host "Committed."
}

# 3) remote & push (if RepoUrl given)
if ($RepoUrl) {
    $existing = git remote get-url origin 2>$null
    if ($existing -and $existing -ne $RepoUrl) {
        Write-Host "Replacing remote origin with: $RepoUrl"
        git remote remove origin 2>$null
    }
    if (-not (git remote get-url origin 2>$null)) {
        git remote add origin $RepoUrl
    }
    git branch -M main
    Write-Host "Pushing to origin main..."
    git push -u origin main
    Write-Host "Done. You can now sync on the other PC with: git pull"
} else {
    Write-Host "No RepoUrl. To push, run:"
    Write-Host '  .\git-upload.ps1 -RepoUrl "https://github.com/YOUR_ID/afbscenter.git"'
    Write-Host "Create the repo on GitHub first: https://github.com/new"
}
