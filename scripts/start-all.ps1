$root = Split-Path -Parent $PSScriptRoot

$services = @(
  @{
    Name = "SmartItineraryBackend"
    WorkingDirectory = Join-Path $root "Backend"
    Command = "npm.cmd run dev"
  },
  @{
    Name = "SmartItineraryClient"
    WorkingDirectory = Join-Path $root "Client"
    Command = "npm.cmd run dev"
  },
  @{
    Name = "SmartItineraryML"
    WorkingDirectory = Join-Path $root "ml-service"
    Command = "npm.cmd run dev"
  }
)

foreach ($service in $services) {
  $existing = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -like "powershell*" -and $_.CommandLine -like "*$($service.Name)*"
  }

  if ($existing) {
    Write-Host "$($service.Name) is already running."
    continue
  }

  $windowTitle = $service.Name
  $launchCommand = "Set-Location '$($service.WorkingDirectory)'; `$Host.UI.RawUI.WindowTitle = '$windowTitle'; $($service.Command)"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $launchCommand | Out-Null
  Write-Host "Started $($service.Name)"
}
