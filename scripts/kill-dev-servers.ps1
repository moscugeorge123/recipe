# Stops leftover recipe dev servers so the next terminal can bind its port.
# Processes started in the last 30 seconds are left alone, so running every
# terminal at once does not kill the servers that just came up.
$ErrorActionPreference = 'SilentlyContinue'

$mutex = New-Object System.Threading.Mutex($false, 'Local\RecipeDevKill')
$acquired = $false
try {
  try {
    $acquired = $mutex.WaitOne()
  } catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
  }

  $cutoff = (Get-Date).AddSeconds(-30)
  $pattern = 'dev:mobile|dev:api|dev:dashboard|dev:worker|start mobile|dev api|dev dashboard|expo|vite\.js|worker/index\.ts|src/index\.ts'
  $procs = @(Get-CimInstance Win32_Process | Where-Object {
      $_.Name -eq 'node.exe' -and
      $_.CommandLine -match 'recipe' -and
      $_.CommandLine -notmatch 'firebase' -and
      $_.CommandLine -match $pattern -and
      $_.CreationDate -and
      $_.CreationDate -lt $cutoff
    })

  $ids = @{}
  foreach ($proc in $procs) { $ids[$proc.ProcessId] = $true }

  $roots = $procs | Where-Object { -not $ids.ContainsKey([int]$_.ParentProcessId) }
  foreach ($proc in $roots) {
    & taskkill.exe /PID $proc.ProcessId /T /F *> $null
  }
} finally {
  if ($acquired) { [void]$mutex.ReleaseMutex() }
  $mutex.Dispose()
}
