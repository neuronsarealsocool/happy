param(
    [switch]$SkipLogin,
    [switch]$NoStartup,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"
try {
    $global:PSNativeCommandUseErrorActionPreference = $false
}
catch {
}

$AppName = "Happy Codex"
$HappyWebUrl = "https://queued-tablet-2f9v.here.now/"
$InstallDir = Join-Path $env:LOCALAPPDATA "HappyCodex"
$LogDir = Join-Path $InstallDir "logs"
$StartMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Happy Codex"
$StartupDir = [Environment]::GetFolderPath("Startup")
$DesktopDir = [Environment]::GetFolderPath("DesktopDirectory")
$TranscriptPath = Join-Path $LogDir ("install-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
$CommandPath = [Environment]::GetCommandLineArgs()[0]
$RawArgs = [Environment]::GetCommandLineArgs() | Select-Object -Skip 1
if ($RawArgs -contains "-SkipLogin") { $SkipLogin = $true }
if ($RawArgs -contains "-NoStartup") { $NoStartup = $true }
if ($RawArgs -contains "-NoPause") { $NoPause = $true }
$IsCompiledExe = $CommandPath -and (Test-Path $CommandPath) -and ([IO.Path]::GetExtension($CommandPath) -ieq ".exe")
$TranscriptStarted = $false
$BundledTrayScript = $null

New-Item -ItemType Directory -Force -Path $InstallDir, $LogDir, $StartMenuDir | Out-Null
if (-not $IsCompiledExe) {
    Start-Transcript -Path $TranscriptPath -Append | Out-Null
    $TranscriptStarted = $true
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Find-CommandPath {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    return $null
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = @($machinePath, $userPath) -join ";"
}

function Add-UserPathEntry {
    param([string]$PathEntry)

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = @()
    if ($userPath) {
        $entries = $userPath -split ";" | Where-Object { $_ }
    }

    if ($entries -notcontains $PathEntry) {
        $newPath = (@($entries) + $PathEntry) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    }

    Refresh-Path
}

function Invoke-Logged {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    Write-Host "> $FilePath $($Arguments -join ' ')"
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0 -and -not $AllowFailure) {
        throw "Command failed with exit code $($process.ExitCode): $FilePath $($Arguments -join ' ')"
    }
    return $process.ExitCode
}

function Get-NpmGlobalRoot {
    $npm = Find-CommandPath @("npm.cmd", "npm")
    if (-not $npm) {
        return $null
    }

    $root = (& cmd.exe /d /s /c "`"$npm`" root -g 2>nul")
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        return $null
    }

    return ($root | Select-Object -First 1).Trim()
}

function Get-InstalledPackageVersion {
    param([string]$PackageName)

    $root = Get-NpmGlobalRoot
    if (-not $root) {
        return $null
    }

    $packagePath = Join-Path $root $PackageName
    $packageJsonPath = Join-Path $packagePath "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        return $null
    }

    try {
        return (Get-Content -Raw $packageJsonPath | ConvertFrom-Json).version
    }
    catch {
        return $null
    }
}

function Get-LatestPackageVersion {
    param([string]$PackageName)

    $npm = Find-CommandPath @("npm.cmd", "npm")
    if (-not $npm) {
        return $null
    }

    $version = (& cmd.exe /d /s /c "`"$npm`" view $PackageName version 2>nul")
    if ($LASTEXITCODE -ne 0 -or -not $version) {
        return $null
    }

    return ($version | Select-Object -First 1).Trim()
}

function Stop-HappyDaemonForUpdate {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if ($happy) {
        Invoke-Logged $happy @("daemon", "stop") -AllowFailure | Out-Null
    }
}

function Install-NodeIfNeeded {
    Refresh-Path
    $node = Find-CommandPath @("node.exe", "node")
    $npm = Find-CommandPath @("npm.cmd", "npm")

    if ($node -and $npm) {
        Write-Host "Node found: $node"
        Write-Host "npm found: $npm"
        return
    }

    Write-Step "Installing Node.js LTS"
    $winget = Find-CommandPath @("winget.exe", "winget")
    if (-not $winget) {
        Start-Process "https://nodejs.org/en/download"
        throw "Node.js is required, and winget was not found. Install Node.js LTS from the page that opened, then run this installer again."
    }

    Invoke-Logged $winget @(
        "install",
        "--id", "OpenJS.NodeJS.LTS",
        "--source", "winget",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--silent"
    )

    Refresh-Path
    $node = Find-CommandPath @("node.exe", "node")
    $npm = Find-CommandPath @("npm.cmd", "npm")
    if (-not ($node -and $npm)) {
        throw "Node.js installation finished, but node/npm were not found on PATH. Restart Windows or install Node.js LTS manually, then run this installer again."
    }
}

function Install-OrUpdateCliTools {
    Write-Step "Installing or updating Happy and Codex CLI"
    $npm = Find-CommandPath @("npm.cmd", "npm")
    if (-not $npm) {
        throw "npm was not found."
    }

    Add-UserPathEntry (Join-Path $env:APPDATA "npm")

    $packages = @("happy", "@openai/codex")
    $updates = @()
    foreach ($package in $packages) {
        $installed = Get-InstalledPackageVersion $package
        $latest = Get-LatestPackageVersion $package
        if (-not $installed) {
            Write-Host "$package is not installed."
            $updates += $package
        }
        elseif (-not $latest) {
            Write-Host "Could not check latest $package version; keeping installed $installed."
        }
        elseif ($installed -ne $latest) {
            Write-Host "$package update required: $installed -> $latest"
            $updates += $package
        }
        else {
            Write-Host "$package is current: $installed"
        }
    }

    if ($updates.Count -gt 0) {
        Stop-HappyDaemonForUpdate
        Invoke-Logged $npm (@("install", "-g") + $updates)
    }
    else {
        Write-Host "Happy and Codex CLI are already current."
    }
}

function Write-InstalledScripts {
    Write-Step "Writing launcher scripts"

    $startScript = @'
@echo off
setlocal

set "HAPPY_WEBAPP_URL=https://queued-tablet-2f9v.here.now/"
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\OpenAI\Codex\bin;%PATH%"

where happy.cmd >nul 2>nul
if errorlevel 1 (
  echo Happy is not installed yet.
  echo Run the Happy Codex installer or this command:
  echo npm install -g happy
  pause
  exit /b 1
)

where codex.cmd >nul 2>nul
if errorlevel 1 (
  echo Codex CLI is not installed yet.
  echo Installing it now...
  call npm.cmd install -g @openai/codex
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

cd /d "%USERPROFILE%"
call happy.cmd codex

echo.
echo Happy Codex closed.
pause
'@

    $daemonScript = @'
@echo off
setlocal

set "HAPPY_WEBAPP_URL=https://queued-tablet-2f9v.here.now/"
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\OpenAI\Codex\bin;%PATH%"

where happy.cmd >nul 2>nul
if errorlevel 1 exit /b 0

call happy.cmd daemon start > "%LOCALAPPDATA%\HappyCodex\logs\daemon-startup.log" 2>&1
exit /b 0
'@

    $trayTarget = Join-Path $InstallDir "Tray-HappyCodex.ps1"
    if ($BundledTrayScript) {
        Set-Content -Path $trayTarget -Value $BundledTrayScript -Encoding UTF8
    }
    else {
        $traySourceCandidates = @(
            (Join-Path $PSScriptRoot "Tray-HappyCodex.ps1"),
            (Join-Path (Split-Path -Parent $CommandPath) "Tray-HappyCodex.ps1"),
            (Join-Path (Get-Location) "Tray-HappyCodex.ps1")
        )

        $traySource = $traySourceCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
        if ($traySource) {
            Copy-Item -LiteralPath $traySource -Destination $trayTarget -Force
        }
        else {
            Write-Host "Warning: Tray-HappyCodex.ps1 was not found; tray shortcuts will be created after the next update."
        }
    }

    $installedExe = Join-Path $InstallDir "HappyCodexSetup.exe"
    $installedPs1 = Join-Path $InstallDir "Setup-HappyCodex.ps1"

    if ($IsCompiledExe) {
        Copy-Item -LiteralPath $CommandPath -Destination $installedExe -Force
        $updateScript = @"
@echo off
setlocal
set "installer=%LOCALAPPDATA%\HappyCodex\HappyCodexSetup.exe"
if not exist "%installer%" (
  echo Installer executable was not found: %installer%
  pause
  exit /b 1
)
"%installer%"
"@
    }
    else {
        Copy-Item -LiteralPath $PSCommandPath -Destination $installedPs1 -Force
        $updateScript = @'
@echo off
setlocal
set "installer=%LOCALAPPDATA%\HappyCodex\Setup-HappyCodex.ps1"
if not exist "%installer%" (
  echo Installer script was not found: %installer%
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%installer%"
'@
    }

    Set-Content -Path (Join-Path $InstallDir "Start-HappyCodex.cmd") -Value $startScript -Encoding ASCII
    Set-Content -Path (Join-Path $InstallDir "Start-HappyDaemon.cmd") -Value $daemonScript -Encoding ASCII
    Set-Content -Path (Join-Path $InstallDir "Update-HappyCodex.cmd") -Value $updateScript -Encoding ASCII
}

function New-Shortcut {
    param(
        [string]$Path,
        [string]$TargetPath,
        [string]$Arguments = "",
        [string]$WorkingDirectory = $InstallDir,
        [string]$Description = $AppName
    )

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($Path)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    $shortcut.Save()
}

function New-WebShortcut {
    param([string]$Path)

    $content = @"
[InternetShortcut]
URL=$HappyWebUrl
"@
    Set-Content -Path $Path -Value $content -Encoding ASCII
}

function Install-Shortcuts {
    Write-Step "Creating shortcuts"

    $powershell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
    $cmd = Join-Path $env:WINDIR "System32\cmd.exe"
    $startArgs = "/k `"$InstallDir\Start-HappyCodex.cmd`""
    $updateArgs = "/k `"$InstallDir\Update-HappyCodex.cmd`""
    $trayArgs = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallDir\Tray-HappyCodex.ps1`" -StartDaemon"

    New-Shortcut -Path (Join-Path $StartMenuDir "Happy Codex.lnk") -TargetPath $cmd -Arguments $startArgs
    New-Shortcut -Path (Join-Path $StartMenuDir "Happy Codex Tray.lnk") -TargetPath $powershell -Arguments $trayArgs
    New-Shortcut -Path (Join-Path $StartMenuDir "Update and Login Happy Codex.lnk") -TargetPath $cmd -Arguments $updateArgs
    New-WebShortcut -Path (Join-Path $StartMenuDir "Happy Web.url")

    New-Shortcut -Path (Join-Path $DesktopDir "Happy Codex.lnk") -TargetPath $cmd -Arguments $startArgs
    New-WebShortcut -Path (Join-Path $DesktopDir "Happy Web.url")

    if (-not $NoStartup) {
        Remove-Item -LiteralPath (Join-Path $StartupDir "Happy Codex Daemon.lnk") -ErrorAction SilentlyContinue
        New-Shortcut -Path (Join-Path $StartupDir "Happy Codex Tray.lnk") -TargetPath $powershell -Arguments $trayArgs
    }
}

function Configure-HappyEnvironment {
    Write-Step "Configuring Happy web URL"
    [Environment]::SetEnvironmentVariable("HAPPY_WEBAPP_URL", $HappyWebUrl, "User")
    $env:HAPPY_WEBAPP_URL = $HappyWebUrl
}

function Start-HappyDaemon {
    Write-Step "Starting Happy daemon"
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        throw "happy was not found after installation."
    }

    Invoke-Logged $happy @("daemon", "start") -AllowFailure
}

function Start-LoginFlow {
    if ($SkipLogin) {
        return
    }

    Write-Step "Opening login and connection flow"
    $happy = Find-CommandPath @("happy.cmd", "happy")
    $codex = Find-CommandPath @("codex.cmd", "codex")

    if ($codex) {
        Write-Host "Opening Codex login. Close it when it finishes, then this installer will continue."
        Invoke-Logged $codex @("login") -AllowFailure
    }

    Write-Host "Opening Happy login. Choose Mobile App or Web Browser when prompted."
    Invoke-Logged $happy @("auth", "login") -AllowFailure

    Write-Host "Opening Happy Codex once so you can confirm it works."
    Invoke-Logged $happy @("codex") -AllowFailure
}

try {
    Write-Host "$AppName installer"
    Write-Host "Happy web: $HappyWebUrl"
    Write-Host "Install dir: $InstallDir"

    Install-NodeIfNeeded
    Install-OrUpdateCliTools
    Configure-HappyEnvironment
    Write-InstalledScripts
    Install-Shortcuts
    Start-HappyDaemon
    Start-LoginFlow

    Write-Step "Done"
    Write-Host "Happy Codex has been installed."
    Write-Host "Use the Happy Codex desktop shortcut to start a Codex session."
    Write-Host "Use the Happy Web shortcut to open $HappyWebUrl."
}
catch {
    Write-Host ""
    Write-Host "Installation failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Log file: $TranscriptPath"
    throw
}
finally {
    if ($TranscriptStarted) {
        Stop-Transcript | Out-Null
    }
    if (-not $NoPause -and -not ($IsCompiledExe -and $SkipLogin) -and -not [Console]::IsInputRedirected) {
        Write-Host ""
        Read-Host "Press Enter to close"
    }
}
