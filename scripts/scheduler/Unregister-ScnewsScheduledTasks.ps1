$tasks = 'SCN-Ingest-5m','SCN-SendPending-2m'
foreach ($task in $tasks) {
  Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "removed $task"
}
