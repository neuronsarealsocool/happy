param(
    [switch]$StartDaemon
)

$ErrorActionPreference = "Stop"

$AppName = "Happy Codex"
$HappyWebUrl = "https://queued-tablet-2f9v.here.now/"
$InstallDir = Join-Path $env:LOCALAPPDATA "HappyCodex"
$LogDir = Join-Path $InstallDir "logs"
$Launcher = Join-Path $InstallDir "Start-HappyCodex.cmd"
$DaemonLauncher = Join-Path $InstallDir "Start-HappyDaemon.cmd"

New-Item -ItemType Directory -Force -Path $InstallDir, $LogDir | Out-Null

function Set-HappyEnvironment {
    $env:HAPPY_WEBAPP_URL = $HappyWebUrl
    $env:Path = @(
        (Join-Path $env:APPDATA "npm"),
        (Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"),
        [Environment]::GetEnvironmentVariable("Path", "Machine"),
        [Environment]::GetEnvironmentVariable("Path", "User")
    ) -join ";"
}

function Find-CommandPath {
    param([string[]]$Names)

    Set-HappyEnvironment
    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    return $null
}

function Start-ConsoleCommand {
    param(
        [string]$Title,
        [string]$Command
    )

    $escaped = $Command.Replace('"', '\"')
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", "title $Title && $escaped") -WorkingDirectory $env:USERPROFILE | Out-Null
}

function Start-HiddenCommand {
    param([string]$Command)

    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $Command) -WindowStyle Hidden -WorkingDirectory $env:USERPROFILE | Out-Null
}

function Show-Balloon {
    param(
        [System.Windows.Forms.NotifyIcon]$Icon,
        [string]$Title,
        [string]$Text
    )

    $Icon.BalloonTipTitle = $Title
    $Icon.BalloonTipText = $Text
    $Icon.ShowBalloonTip(2500)
}

function Start-HappyDaemon {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        return $false
    }

    $log = Join-Path $LogDir "daemon-startup.log"
    Start-HiddenCommand "`"$happy`" daemon start > `"$log`" 2>&1"
    return $true
}

function Stop-HappyDaemon {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        return $false
    }

    $log = Join-Path $LogDir "daemon-stop.log"
    Start-HiddenCommand "`"$happy`" daemon stop > `"$log`" 2>&1"
    return $true
}

function Open-HappyCodex {
    if (Test-Path $Launcher) {
        Start-Process -FilePath $Launcher -WorkingDirectory $InstallDir | Out-Null
        return
    }

    Start-ConsoleCommand "Happy Codex" "happy.cmd codex"
}

function Open-HappyWeb {
    Start-Process $HappyWebUrl | Out-Null
}

function Open-HappyLogin {
    Start-ConsoleCommand "Happy Login" "happy.cmd auth login"
}

function Open-CodexLogin {
    Start-ConsoleCommand "Codex Login" "codex.cmd login"
}

function Update-Everything {
    $updater = Join-Path $InstallDir "Update-HappyCodex.cmd"
    if (Test-Path $updater) {
        Start-Process -FilePath $updater -WorkingDirectory $InstallDir | Out-Null
        return
    }

    $installer = Join-Path $InstallDir "HappyCodexSetup.exe"
    if (Test-Path $installer) {
        Start-Process -FilePath $installer -WorkingDirectory $InstallDir | Out-Null
        return
    }

    $npm = Find-CommandPath @("npm.cmd", "npm")
    if (-not $npm) {
        Start-Process "https://nodejs.org/en/download" | Out-Null
        return
    }

    $command = "`"$npm`" install -g happy @openai/codex && happy.cmd daemon start && echo. && echo Update complete."
    Start-ConsoleCommand "Update Happy Codex" $command
}

function Open-Doctor {
    Start-ConsoleCommand "Happy Codex Doctor" "happy.cmd doctor && echo. && codex.cmd doctor --summary"
}

function Open-Logs {
    Invoke-Item $LogDir
}

Set-HappyEnvironment

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = $AppName
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

function Add-MenuItem {
    param(
        [string]$Text,
        [scriptblock]$OnClick
    )

    $item = New-Object System.Windows.Forms.ToolStripMenuItem
    $item.Text = $Text
    $item.Add_Click($OnClick)
    [void]$menu.Items.Add($item)
}

Add-MenuItem "Open Happy Codex" { Open-HappyCodex }
Add-MenuItem "Open Happy Web" { Open-HappyWeb }
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-MenuItem "Start Daemon" {
    if (Start-HappyDaemon) {
        Show-Balloon $notifyIcon "Happy Codex" "Daemon start requested."
    }
    else {
        Show-Balloon $notifyIcon "Happy Codex" "Happy CLI was not found. Run Update Everything."
    }
}
Add-MenuItem "Stop Daemon" {
    if (Stop-HappyDaemon) {
        Show-Balloon $notifyIcon "Happy Codex" "Daemon stop requested."
    }
    else {
        Show-Balloon $notifyIcon "Happy Codex" "Happy CLI was not found."
    }
}
Add-MenuItem "Restart Daemon" {
    Stop-HappyDaemon | Out-Null
    Start-Sleep -Seconds 2
    Start-HappyDaemon | Out-Null
    Show-Balloon $notifyIcon "Happy Codex" "Daemon restart requested."
}
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-MenuItem "Login to Happy" { Open-HappyLogin }
Add-MenuItem "Login to Codex" { Open-CodexLogin }
Add-MenuItem "Update Everything" { Update-Everything }
Add-MenuItem "Run Doctor" { Open-Doctor }
Add-MenuItem "Open Logs" { Open-Logs }
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-MenuItem "Exit Tray" {
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
}

$notifyIcon.ContextMenuStrip = $menu
$notifyIcon.Add_DoubleClick({ Open-HappyCodex })

if ($StartDaemon) {
    Start-HappyDaemon | Out-Null
}

Show-Balloon $notifyIcon "Happy Codex" "Tray controller is running."
[System.Windows.Forms.Application]::Run()
