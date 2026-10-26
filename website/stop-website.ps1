$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot 'data\server.pid'
if (-not (Test-Path $pidFile)) {
  Write-Host 'The website server is not running.'
  exit 0
}
$serverId = Get-Content $pidFile -ErrorAction SilentlyContinue
if ($serverId -and (Get-Process -Id $serverId -ErrorAction SilentlyContinue)) {
  Stop-Process -Id $serverId
  Write-Host "Stopped website server (PID $serverId)."
} else {
  Write-Host 'The recorded website process was already stopped.'
}
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
