$repoRoot = "$env:USERPROFILE\.openclaw\workspace\scnews"
& (Join-Path $repoRoot 'scripts\scheduler\Invoke-ScnewsJob.ps1') `
  -JobName 'SCN-SendPending-2m' `
  -Endpoint 'https://scnews-agent.vercel.app/api/jobs/send-pending' `
  -RepoRoot $repoRoot
