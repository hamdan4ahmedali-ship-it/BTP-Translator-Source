$ErrorActionPreference = 'Stop'
$website = $PSScriptRoot
$project = Split-Path $website -Parent
$data = Join-Path $website 'data'
$pidFile = Join-Path $data 'server.pid'
New-Item -ItemType Directory -Force -Path $data | Out-Null

if (Test-Path $pidFile) {
  $existing = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existing -and (Get-Process -Id $existing -ErrorAction SilentlyContinue)) {
    Write-Host "The website server is already running (PID $existing)."
    exit 0
  }
}

$envFile = Join-Path $website '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $splitAt = $line.IndexOf('=')
    if ($splitAt -lt 1) { return }
    $name = $line.Substring(0, $splitAt).Trim()
    $value = $line.Substring($splitAt + 1).Trim()
    Set-Item -Path "Env:$name" -Value $value
  }
}

$outLog = Join-Path $data 'server.out.log'
$errLog = Join-Path $data 'server.err.log'
$process = Start-Process -FilePath 'node' -ArgumentList 'website/server.js' -WorkingDirectory $project -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
Set-Content -Path $pidFile -Value $process.Id
Start-Sleep -Seconds 1
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
  Write-Host "The website server stopped immediately. Read $errLog"
  exit 1
}
$port = if ($env:PORT) { $env:PORT } else { '4173' }
Write-Host "Website server started (PID $($process.Id))."
Write-Host "Local address: http://127.0.0.1:$port"
