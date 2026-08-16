$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$OutDir = Join-Path $RepoRoot "dist\windows"
$ExePath = Join-Path $OutDir "HappyCodexSetup.exe"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

try {
    Import-Module ps2exe -ErrorAction Stop
}
catch {
    throw "The ps2exe module is required. Install it with: Install-Module ps2exe -Scope CurrentUser"
}

Invoke-ps2exe `
    -inputFile (Join-Path $ScriptDir "Setup-HappyCodex.ps1") `
    -outputFile $ExePath `
    -title "Happy Codex Setup" `
    -description "Installs and updates Happy Codex for Windows" `
    -company "Happy Codex" `
    -product "Happy Codex Setup" `
    -version "1.0.0.0" `
    -conHost `
    -supportOS

if (-not (Test-Path $ExePath)) {
    throw "Expected installer was not created: $ExePath"
}

Write-Host "Created $ExePath"
