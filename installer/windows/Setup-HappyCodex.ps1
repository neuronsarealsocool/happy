param(
    [switch]$SkipLogin,
    [switch]$NoStartup,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

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
    Invoke-Logged $npm @("install", "-g", "happy", "@openai/codex")
}

function Write-InstalledScripts {
    Write-Step "Writing launcher scripts"

    $startScript = @'
$ErrorActionPreference = "Stop"
$env:HAPPY_WEBAPP_URL = "https://queued-tablet-2f9v.here.now/"
$env:Path = @(
    [Environment]::GetEnvironmentVariable("Path", "Machine"),
    [Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

$happy = Get-Command happy.cmd -ErrorAction SilentlyContinue
if (-not $happy) {
    Write-Host "Happy is not installed yet. Run the Happy Codex installer first."
    Read-Host "Press Enter to close"
    exit 1
}

Set-Location $HOME
& $happy.Source codex
'@

    $daemonScript = @'
$ErrorActionPreference = "Stop"
$env:HAPPY_WEBAPP_URL = "https://queued-tablet-2f9v.here.now/"
$env:Path = @(
    [Environment]::GetEnvironmentVariable("Path", "Machine"),
    [Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

$happy = Get-Command happy.cmd -ErrorAction SilentlyContinue
if ($happy) {
    & $happy.Source daemon start *> "$env:LOCALAPPDATA\HappyCodex\logs\daemon-startup.log"
}
'@

    $installedExe = Join-Path $InstallDir "HappyCodexSetup.exe"
    $installedPs1 = Join-Path $InstallDir "Setup-HappyCodex.ps1"

    if ($IsCompiledExe) {
        Copy-Item -LiteralPath $CommandPath -Destination $installedExe -Force
        $updateScript = @"
`$ErrorActionPreference = "Stop"
`$installer = Join-Path `$env:LOCALAPPDATA "HappyCodex\HappyCodexSetup.exe"
if (-not (Test-Path `$installer)) {
    Write-Host "Installer executable was not found: `$installer"
    Read-Host "Press Enter to close"
    exit 1
}

& `$installer
"@
    }
    else {
        Copy-Item -LiteralPath $PSCommandPath -Destination $installedPs1 -Force
        $updateScript = @'
$ErrorActionPreference = "Stop"
$installer = Join-Path $env:LOCALAPPDATA "HappyCodex\Setup-HappyCodex.ps1"
if (-not (Test-Path $installer)) {
    Write-Host "Installer script was not found: $installer"
    Read-Host "Press Enter to close"
    exit 1
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
'@
    }

    Set-Content -Path (Join-Path $InstallDir "Start-HappyCodex.ps1") -Value $startScript -Encoding UTF8
    Set-Content -Path (Join-Path $InstallDir "Start-HappyDaemon.ps1") -Value $daemonScript -Encoding UTF8
    Set-Content -Path (Join-Path $InstallDir "Update-HappyCodex.ps1") -Value $updateScript -Encoding UTF8
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
    $startArgs = "-NoExit -ExecutionPolicy Bypass -File `"$InstallDir\Start-HappyCodex.ps1`""
    $updateArgs = "-NoExit -ExecutionPolicy Bypass -File `"$InstallDir\Update-HappyCodex.ps1`""
    $daemonArgs = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$InstallDir\Start-HappyDaemon.ps1`""

    New-Shortcut -Path (Join-Path $StartMenuDir "Happy Codex.lnk") -TargetPath $powershell -Arguments $startArgs
    New-Shortcut -Path (Join-Path $StartMenuDir "Update and Login Happy Codex.lnk") -TargetPath $powershell -Arguments $updateArgs
    New-WebShortcut -Path (Join-Path $StartMenuDir "Happy Web.url")

    New-Shortcut -Path (Join-Path $DesktopDir "Happy Codex.lnk") -TargetPath $powershell -Arguments $startArgs
    New-WebShortcut -Path (Join-Path $DesktopDir "Happy Web.url")

    if (-not $NoStartup) {
        New-Shortcut -Path (Join-Path $StartupDir "Happy Codex Daemon.lnk") -TargetPath $powershell -Arguments $daemonArgs
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
