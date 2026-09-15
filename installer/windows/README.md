# Agentic Messenger Windows installer

This folder builds a Windows installer executable for Agentic Messenger.

The installer:

- Installs Node.js LTS with `winget` if Node/npm are missing.
- Installs or updates `happy` and `@openai/codex` with npm, skipping packages that are already current.
- Sets the user environment variable `HAPPY_WEBAPP_URL` to `https://queued-tablet-2f9v.here.now/`.
- Creates Desktop and Start Menu shortcuts for Agentic Messenger, Agentic Messenger Tray, and Agentic Messenger Web.
- Installs an Agentic Messenger tray controller for start/stop/restart daemon, login, updates, doctor, logs, and Agentic Messenger Web.
- Adds a user Run-key startup entry that launches the tray controller through hidden PowerShell, starts the Happy daemon hidden, retries if it is not running, and does not show a command prompt when Windows signs in.
- Ensures only one tray instance runs even if the tray is launched more than once.
- Runs the interactive Codex and Happy login/start flow.

Build it on Windows after installing the `ps2exe` PowerShell module:

```powershell
Install-Module ps2exe -Scope CurrentUser
powershell.exe -ExecutionPolicy Bypass -File .\installer\windows\build.ps1
```

The generated installer is written to:

```text
dist\windows\AgenticMessengerSetup.exe
```

For silent-ish refreshes after installation, users can run the Start Menu shortcut named
`Update and Login Agentic Messenger`.
