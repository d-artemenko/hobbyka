param(
  [Parameter(Position = 0)]
  [string]$Event
)

$ErrorActionPreference = "SilentlyContinue"
if ($Event -notin @("session-start", "post-tool-use")) { exit 0 }
if ([string]::IsNullOrWhiteSpace($env:CODEX_THREAD_ID)) { exit 0 }

$root = if ($env:PLUGIN_ROOT) {
  $env:PLUGIN_ROOT
} else {
  Split-Path -Parent $PSScriptRoot
}
$cli = Join-Path $root "scripts\hchat.ps1"
if (-not (Test-Path $cli)) { exit 0 }

try {
  $output = & $cli hook $Event --thread $env:CODEX_THREAD_ID 2>$null
  if ($LASTEXITCODE -eq 0 -and $null -ne $output) {
    [Console]::Out.Write(($output -join [Environment]::NewLine))
  }
} catch {}
exit 0
