param(
    [switch]$StartDaemon,
    [ValidateSet("StartDaemon", "StopDaemon", "RestartDaemon", "OpenAgenticMessenger", "OpenAgenticMessengerWeb", "LoginHappy", "LoginCodex", "UpdateEverything", "Doctor", "OpenLogs", "SelfTest")]
    [string]$Action
)

$ErrorActionPreference = "Stop"

$AppName = "Agentic Messenger"
$AppKey = "AgenticMessenger"
$AgenticMessengerWebUrl = "https://queued-tablet-2f9v.here.now/"
$InstallDir = Join-Path $env:LOCALAPPDATA $AppKey
$LogDir = Join-Path $InstallDir "logs"
$Launcher = Join-Path $InstallDir "Start-AgenticMessenger.cmd"
$DaemonLauncher = Join-Path $InstallDir "Start-AgenticMessengerDaemon.cmd"
$TrayIconPath = Join-Path $InstallDir "AgenticMessenger.ico"

New-Item -ItemType Directory -Force -Path $InstallDir, $LogDir | Out-Null

function Set-HappyEnvironment {
    $env:HAPPY_WEBAPP_URL = $AgenticMessengerWebUrl
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
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$LogPath,
        [switch]$Wait
    )

    $startArgs = @{
        FilePath = $FilePath
        ArgumentList = $Arguments
        WindowStyle = "Hidden"
        WorkingDirectory = $env:USERPROFILE
        PassThru = $true
    }

    if ($LogPath) {
        $startArgs.RedirectStandardOutput = $LogPath
        $startArgs.RedirectStandardError = "$LogPath.err"
    }

    $process = Start-Process @startArgs
    if ($Wait) {
        $process.WaitForExit()
        return $process.ExitCode
    }

    return 0
}

function Test-HappyDaemonRunning {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        return $false
    }

    $output = & $happy doctor 2>$null
    return (($output -join "`n") -match "Daemon is running")
}

function Wait-HappyDaemonRunning {
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if (Test-HappyDaemonRunning) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Wait-HappyDaemonStopped {
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-HappyDaemonRunning)) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
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

function Start-AgenticMessengerDaemon {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        return $false
    }

    $log = Join-Path $LogDir "daemon-startup.log"
    Start-HiddenCommand $happy @("daemon", "start") $log | Out-Null
    return (Wait-HappyDaemonRunning)
}

function Stop-AgenticMessengerDaemon {
    $happy = Find-CommandPath @("happy.cmd", "happy")
    if (-not $happy) {
        return $false
    }

    $log = Join-Path $LogDir "daemon-stop.log"
    $exitCode = Start-HiddenCommand $happy @("daemon", "stop") $log -Wait
    return ($exitCode -eq 0 -and (Wait-HappyDaemonStopped))
}

function Open-AgenticMessenger {
    if (Test-Path $Launcher) {
        Start-Process -FilePath $Launcher -WorkingDirectory $InstallDir | Out-Null
        return
    }

    Start-ConsoleCommand "Agentic Messenger" "happy.cmd codex"
}

function Open-AgenticMessengerWeb {
    Start-Process $AgenticMessengerWebUrl | Out-Null
}

function Open-HappyLogin {
    Start-ConsoleCommand "Happy Login" "happy.cmd auth login"
}

function Open-CodexLogin {
    Start-ConsoleCommand "Codex Login" "codex.cmd login"
}

function Update-Everything {
    $updater = Join-Path $InstallDir "Update-AgenticMessenger.cmd"
    if (Test-Path $updater) {
        Start-Process -FilePath $updater -WorkingDirectory $InstallDir | Out-Null
        return
    }

    $installer = Join-Path $InstallDir "AgenticMessengerSetup.exe"
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
    Start-ConsoleCommand "Update Agentic Messenger" $command
}

function Open-Doctor {
    Start-ConsoleCommand "Agentic Messenger Doctor" "happy.cmd doctor && echo. && codex.cmd doctor --summary"
}

function Open-Logs {
    Invoke-Item $LogDir
}

function Test-AgenticMessengerTray {
    Set-HappyEnvironment

    $happy = Find-CommandPath @("happy.cmd", "happy")
    $codex = Find-CommandPath @("codex.cmd", "codex")
    $updater = Join-Path $InstallDir "Update-AgenticMessenger.cmd"
    $trayScript = Join-Path $InstallDir "Tray-AgenticMessenger.ps1"
    $startupTray = Join-Path ([Environment]::GetFolderPath("Startup")) "Agentic Messenger Tray.lnk"
    $startupDaemon = Join-Path ([Environment]::GetFolderPath("Startup")) "Agentic Messenger Daemon.lnk"
    $legacyStartupTray = Join-Path ([Environment]::GetFolderPath("Startup")) "Happy Codex Tray.lnk"
    $legacyStartupDaemon = Join-Path ([Environment]::GetFolderPath("Startup")) "Happy Codex Daemon.lnk"
    $startupShortcut = $null
    if (Test-Path $startupTray) {
        $shell = New-Object -ComObject WScript.Shell
        $startupShortcut = $shell.CreateShortcut($startupTray)
    }

    $checks = @(
        [pscustomobject]@{ Name = "Happy CLI"; Ok = [bool]$happy; Detail = $happy },
        [pscustomobject]@{ Name = "Codex CLI"; Ok = [bool]$codex; Detail = $codex },
        [pscustomobject]@{ Name = "Agentic Messenger launcher"; Ok = (Test-Path $Launcher); Detail = $Launcher },
        [pscustomobject]@{ Name = "Daemon launcher"; Ok = (Test-Path $DaemonLauncher); Detail = $DaemonLauncher },
        [pscustomobject]@{ Name = "Updater launcher"; Ok = (Test-Path $updater); Detail = $updater },
        [pscustomobject]@{ Name = "Tray script"; Ok = (Test-Path $trayScript); Detail = $trayScript },
        [pscustomobject]@{ Name = "Tray startup shortcut"; Ok = (Test-Path $startupTray); Detail = $startupTray },
        [pscustomobject]@{ Name = "Tray startup uses hidden PowerShell"; Ok = ($startupShortcut -and $startupShortcut.TargetPath -match "powershell.exe$" -and $startupShortcut.Arguments -match "WindowStyle Hidden" -and $startupShortcut.Arguments -match "Tray-AgenticMessenger\.ps1"); Detail = if ($startupShortcut) { "$($startupShortcut.TargetPath) $($startupShortcut.Arguments)" } else { "" } },
        [pscustomobject]@{ Name = "Daemon startup shortcut removed"; Ok = (-not (Test-Path $startupDaemon)); Detail = $startupDaemon },
        [pscustomobject]@{ Name = "Legacy Happy Codex tray startup removed"; Ok = (-not (Test-Path $legacyStartupTray)); Detail = $legacyStartupTray },
        [pscustomobject]@{ Name = "Legacy Happy Codex daemon startup removed"; Ok = (-not (Test-Path $legacyStartupDaemon)); Detail = $legacyStartupDaemon },
        [pscustomobject]@{ Name = "Tray icon"; Ok = (Test-Path $TrayIconPath); Detail = $TrayIconPath },
        [pscustomobject]@{ Name = "Agentic Messenger web URL"; Ok = ($AgenticMessengerWebUrl -eq "https://queued-tablet-2f9v.here.now/"); Detail = $AgenticMessengerWebUrl }
    )

    foreach ($check in $checks) {
        if ($check.Ok) {
            Write-Host "PASS $($check.Name): $($check.Detail)"
        }
        else {
            Write-Host "FAIL $($check.Name): $($check.Detail)"
        }
    }

    if ($checks | Where-Object { -not $_.Ok }) {
        exit 1
    }
}

function Invoke-TrayAction {
    param([string]$Name)

    switch ($Name) {
        "StartDaemon" {
            if (-not (Start-AgenticMessengerDaemon)) { exit 1 }
        }
        "StopDaemon" {
            if (-not (Stop-AgenticMessengerDaemon)) { exit 1 }
        }
        "RestartDaemon" {
            Stop-AgenticMessengerDaemon | Out-Null
            Start-Sleep -Seconds 2
            if (-not (Start-AgenticMessengerDaemon)) { exit 1 }
        }
        "OpenAgenticMessenger" { Open-AgenticMessenger }
        "OpenAgenticMessengerWeb" { Open-AgenticMessengerWeb }
        "LoginHappy" { Open-HappyLogin }
        "LoginCodex" { Open-CodexLogin }
        "UpdateEverything" { Update-Everything }
        "Doctor" { Open-Doctor }
        "OpenLogs" { Open-Logs }
        "SelfTest" { Test-AgenticMessengerTray }
    }
}

Set-HappyEnvironment

if ($Action) {
    Invoke-TrayAction $Action
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = $AppName
if (Test-Path $TrayIconPath) {
    $notifyIcon.Icon = New-Object System.Drawing.Icon($TrayIconPath)
}
else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Visible = $true
$script:KeepDaemonRunning = [bool]$StartDaemon

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

Add-MenuItem "Open Agentic Messenger Web" { Open-AgenticMessengerWeb }
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
Add-MenuItem "Start Daemon" {
    $script:KeepDaemonRunning = $true
    if (Start-AgenticMessengerDaemon) {
        Show-Balloon $notifyIcon $AppName "Daemon start requested."
    }
    else {
        Show-Balloon $notifyIcon $AppName "Happy CLI was not found. Run Update Everything."
    }
}
Add-MenuItem "Stop Daemon" {
    $script:KeepDaemonRunning = $false
    if (Stop-AgenticMessengerDaemon) {
        Show-Balloon $notifyIcon $AppName "Daemon stop requested."
    }
    else {
        Show-Balloon $notifyIcon $AppName "Happy CLI was not found."
    }
}
Add-MenuItem "Restart Daemon" {
    $script:KeepDaemonRunning = $true
    Stop-AgenticMessengerDaemon | Out-Null
    Start-Sleep -Seconds 2
    Start-AgenticMessengerDaemon | Out-Null
    Show-Balloon $notifyIcon $AppName "Daemon restart requested."
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
$notifyIcon.Add_DoubleClick({ Open-AgenticMessengerWeb })

$daemonTimer = New-Object System.Windows.Forms.Timer
$daemonTimer.Interval = 30000
$daemonTimer.Add_Tick({
    if ($script:KeepDaemonRunning -and -not (Test-HappyDaemonRunning)) {
        Start-AgenticMessengerDaemon | Out-Null
    }
})
$daemonTimer.Start()

if ($StartDaemon) {
    Start-AgenticMessengerDaemon | Out-Null
}

Show-Balloon $notifyIcon $AppName "Tray controller is running."
[System.Windows.Forms.Application]::Run()
