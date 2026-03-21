$serviceNames = @(
  "SmartItineraryBackend",
  "SmartItineraryClient",
  "SmartItineraryML"
)

foreach ($serviceName in $serviceNames) {
  $matchingProcesses = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -like "powershell*" -and $_.CommandLine -like "*$serviceName*"
  }

  foreach ($process in $matchingProcesses) {
    Stop-Process -Id $process.ProcessId -Force
    Write-Host "Stopped $serviceName"
  }
}
