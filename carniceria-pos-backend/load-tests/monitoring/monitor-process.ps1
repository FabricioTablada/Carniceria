<#
.SYNOPSIS
  load-tests/monitoring/monitor-process.ps1 (Fase 15, Bloque D)

.DESCRIPTION
  Muestrea CPU y memoria (working set) del proceso Node del backend cada
  N segundos mientras corre un escenario de k6 en otra terminal, y escribe
  una fila CSV por muestra. No requiere ningun cambio en el codigo del
  backend (no se agrega ningun endpoint de metricas): usa unicamente
  contadores del sistema operativo sobre el proceso ya en ejecucion.

  Correr el backend con `npm run start` (build de produccion, no `npm run
  dev`/tsx watch) ANTES de iniciar este script, para medir el proceso real
  que correria en produccion.

.PARAMETER ProcessId
  PID del proceso Node del backend (usar Get-Process node para encontrarlo
  si no se conoce; si hay un unico proceso node corriendo, se detecta solo).

.PARAMETER OutFile
  Ruta del CSV de salida.

.PARAMETER IntervalSeconds
  Segundos entre muestras (default 5).

.EXAMPLE
  ./monitor-process.ps1 -OutFile process-metrics.csv -IntervalSeconds 5

.EXAMPLE
  ./monitor-process.ps1 -ProcessId 12345 -OutFile process-metrics.csv
#>
param(
  [int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [int]$IntervalSeconds = 5
)

if (-not $ProcessId) {
  $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

  if (-not $nodeProcesses) {
    Write-Error "No se encontro ningun proceso 'node' corriendo. Inicia el backend (npm run start) primero."
    exit 1
  }

  if ($nodeProcesses.Count -gt 1) {
    Write-Error "Hay multiples procesos 'node' corriendo. Pasa -ProcessId explicitamente:"
    $nodeProcesses | Select-Object Id, StartTime, Path | Format-Table
    exit 1
  }

  $ProcessId = $nodeProcesses.Id
}

"timestamp,pid,cpu_percent,working_set_mb,private_memory_mb,thread_count,handle_count" | Out-File -FilePath $OutFile -Encoding utf8

Write-Host "Muestreando PID $ProcessId cada ${IntervalSeconds}s hacia $OutFile. Ctrl+C para detener."

# CPU% se calcula como delta de tiempo de CPU consumido entre muestras,
# dividido por el tiempo real transcurrido y el numero de nucleos -- Get-Process
# por si solo solo expone el tiempo de CPU ACUMULADO desde que arranco el
# proceso, no un porcentaje instantaneo.
$coreCount = (Get-CimInstance -ClassName Win32_ComputerSystem).NumberOfLogicalProcessors
$previousCpuTime = $null
$previousTimestamp = $null

while ($true) {
  try {
    $proc = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    Write-Warning "El proceso $ProcessId ya no existe. Deteniendo monitoreo."
    break
  }

  $now = Get-Date
  $cpuTime = $proc.TotalProcessorTime.TotalSeconds

  $cpuPercent = 0
  if ($previousCpuTime -ne $null) {
    $elapsedWall = ($now - $previousTimestamp).TotalSeconds
    $elapsedCpu = $cpuTime - $previousCpuTime
    if ($elapsedWall -gt 0) {
      $cpuPercent = [math]::Round(($elapsedCpu / $elapsedWall / $coreCount) * 100, 2)
    }
  }

  $previousCpuTime = $cpuTime
  $previousTimestamp = $now

  $workingSetMb = [math]::Round($proc.WorkingSet64 / 1MB, 2)
  $privateMemMb = [math]::Round($proc.PrivateMemorySize64 / 1MB, 2)

  "$($now.ToString('o')),$ProcessId,$cpuPercent,$workingSetMb,$privateMemMb,$($proc.Threads.Count),$($proc.HandleCount)" |
    Out-File -FilePath $OutFile -Encoding utf8 -Append

  Start-Sleep -Seconds $IntervalSeconds
}
