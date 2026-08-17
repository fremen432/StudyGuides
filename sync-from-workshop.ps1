<#
.SYNOPSIS
  Syncs study guides from the private working copy (C:\vc\workshop\study-guides) into this
  public GitHub Pages repo, then commits and pushes.

.DESCRIPTION
  C:\vc\workshop\study-guides is where guides are authored/updated (study-guide-maker skill).
  This repo is a published mirror of that content, minus the zips\ folder and the Netlify
  export subfolder, which don't belong on the public site.

  Adding a brand-new guide? This script copies the file over, but you still need to add a card
  for it to index.html by hand -- that's deliberate, not automated, so a half-finished guide
  never accidentally shows up as a clickable card on the live site.

.PARAMETER NoPush
  Copy and commit locally but skip the push -- useful for reviewing the diff first.
#>

param(
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$src = "C:\vc\workshop\study-guides"
$dst = "C:\vc\apps\StudyGuides"

if (-not (Test-Path $src)) {
    Write-Error "Source folder not found: $src"
    exit 1
}

Write-Host "Syncing guides from $src ..." -ForegroundColor Cyan

# Guide HTML files at the root of study-guides\ (excludes index.html, which lives only here)
Get-ChildItem -Path $src -Filter "*.html" -File | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dst -Force
    Write-Host "  copied $($_.Name)"
}

# Shared assets and images -- mirror exactly (Robocopy /MIR deletes anything removed at the source)
robocopy "$src\assets" "$dst\assets" /MIR /NFL /NDL /NJH /NJS | Out-Null
robocopy "$src\images" "$dst\images" /MIR /NFL /NDL /NJH /NJS | Out-Null
Write-Host "  synced assets\ and images\"

Set-Location $dst

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing changed -- already up to date." -ForegroundColor Green
    exit 0
}

Write-Host "`nChanges:" -ForegroundColor Cyan
git status --short

git add -A
git commit -m "sync: pull latest guides from workshop" | Out-Null
Write-Host "Committed." -ForegroundColor Green

if ($NoPush) {
    Write-Host "Skipping push (-NoPush). Run 'git push' when ready." -ForegroundColor Yellow
} else {
    git push
    Write-Host "Pushed." -ForegroundColor Green
}
