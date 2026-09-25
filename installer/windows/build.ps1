$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$OutDir = Join-Path $RepoRoot "dist\windows"
$ExePath = Join-Path $OutDir "AgenticMessengerSetup.exe"
$TrayExePath = Join-Path $OutDir "AgenticMessengerTray.exe"
$CompiledInputPath = Join-Path $OutDir "Setup-AgenticMessenger.compiled.ps1"
$IconPath = Join-Path $ScriptDir "AgenticMessenger.ico"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

try {
    Import-Module ps2exe -ErrorAction Stop
}
catch {
    throw "The ps2exe module is required. Install it with: Install-Module ps2exe -Scope CurrentUser"
}

$setupSource = Get-Content -Raw (Join-Path $ScriptDir "Setup-AgenticMessenger.ps1")
$traySource = Get-Content -Raw (Join-Path $ScriptDir "Tray-AgenticMessenger.ps1")
$trayPs2exeArgs = @{
    inputFile = (Join-Path $ScriptDir "Tray-AgenticMessenger.ps1")
    outputFile = $TrayExePath
    title = "Agentic Messenger Tray"
    description = "Controls Agentic Messenger and the Happy daemon"
    company = "Agentic Messenger"
    product = "Agentic Messenger Tray"
    version = "1.0.0.0"
    noConsole = $true
    STA = $true
    supportOS = $true
}

if (Test-Path $IconPath) {
    $trayPs2exeArgs.iconFile = $IconPath
}

Invoke-ps2exe @trayPs2exeArgs
if (-not (Test-Path $TrayExePath)) {
    throw "Expected tray executable was not created: $TrayExePath"
}

$trayBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($traySource))
$bundledTrayAssignment = "`$BundledTrayScript = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(`"$trayBase64`"))"
$compiledInput = $setupSource -replace '\$BundledTrayScript = \$null', $bundledTrayAssignment
$trayExeBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($TrayExePath))
$bundledTrayExeAssignment = "`$BundledTrayExeBase64 = `"$trayExeBase64`""
$compiledInput = $compiledInput -replace '\$BundledTrayExeBase64 = \$null', $bundledTrayExeAssignment

if (Test-Path $IconPath) {
    $iconBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($IconPath))
    $bundledIconAssignment = "`$BundledIconBase64 = `"$iconBase64`""
    $compiledInput = $compiledInput -replace '\$BundledIconBase64 = \$null', $bundledIconAssignment
}

Set-Content -Path $CompiledInputPath -Value $compiledInput -Encoding UTF8

$ps2exeArgs = @{
    inputFile = $CompiledInputPath
    outputFile = $ExePath
    title = "Agentic Messenger Setup"
    description = "Installs and updates Agentic Messenger for Windows"
    company = "Agentic Messenger"
    product = "Agentic Messenger Setup"
    version = "1.0.0.0"
    conHost = $true
    supportOS = $true
}

if (Test-Path $IconPath) {
    $ps2exeArgs.iconFile = $IconPath
}

Invoke-ps2exe @ps2exeArgs

if (-not (Test-Path $ExePath)) {
    throw "Expected installer was not created: $ExePath"
}

Write-Host "Created $ExePath"
Write-Host "Created $TrayExePath"
