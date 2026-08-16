# Happy Codex Windows installer

This folder builds a Windows installer executable for Happy Codex.

The installer:

- Installs Node.js LTS with `winget` if Node/npm are missing.
- Installs or updates `happy` and `@openai/codex` with npm.
- Sets the user environment variable `HAPPY_WEBAPP_URL` to `https://queued-tablet-2f9v.here.now/`.
- Creates Desktop and Start Menu shortcuts for Happy Codex and Happy Web.
- Adds a Startup shortcut that starts `happy daemon start` when Windows signs in.
- Runs the interactive Codex and Happy login/start flow.

Build it on Windows after installing the `ps2exe` PowerShell module:

```powershell
Install-Module ps2exe -Scope CurrentUser
powershell.exe -ExecutionPolicy Bypass -File .\installer\windows\build.ps1
```

The generated installer is written to:

```text
dist\windows\HappyCodexSetup.exe
```

For silent-ish refreshes after installation, users can run the Start Menu shortcut named
`Update and Login Happy Codex`.
