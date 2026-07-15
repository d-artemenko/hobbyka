$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $env:HCHAT_SERVER) { $env:HCHAT_SERVER = "https://172.29.172.1" }
if (-not $env:HCHAT_CA_FILE) { $env:HCHAT_CA_FILE = Join-Path $root "assets\hobbyka-chat-root.crt" }
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }
$binary = Join-Path $root "bin\windows-$arch\hchat.exe"
if (-not (Test-Path $binary)) {
  Write-Error '{"error":"unsupported Windows build or missing hchat.exe"}'
  exit 1
}
& $binary @args
exit $LASTEXITCODE
