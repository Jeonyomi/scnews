$repoRoot = "$env:USERPROFILE\.openclaw\workspace\scnews"
& (Join-Path $repoRoot 'scripts\scheduler\Invoke-ScnewsJob.ps1') `
  -JobName 'SCN-Ingest-5m' `
  -Endpoint 'https://scnews.vercel.app/api/jobs/ingest' `
  -RepoRoot $repoRoot
