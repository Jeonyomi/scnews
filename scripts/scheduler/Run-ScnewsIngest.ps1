$repoRoot = "$env:USERPROFILE\.openclaw\workspace\scnews"
& (Join-Path $repoRoot 'scripts\scheduler\Invoke-ScnewsJob.ps1') `
  -JobName 'SCN-Ingest-5m' `
  -Endpoint 'https://scnews-agent.vercel.app/api/jobs/ingest' `
  -RepoRoot $repoRoot
