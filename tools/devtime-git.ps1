<#
.SYNOPSIS
  Estimates development time from this repo's git history.

.DESCRIPTION
  Everything you do ends up as commits in one repo (pushed from any machine), so
  git history is a single, already-merged source of truth — no per-machine log
  juggling needed.

  Heuristic (matches the agreed rules):
    * Commits are grouped into work sessions. A gap longer than -GapMinutes
      between two consecutive commits starts a new session (default 60 min, i.e.
      "less than an hour apart = same session").
    * A session's time = (last commit - first commit) of that session, PLUS a
      lead-in (default 10 min) for the work you did before the first commit landed.
    * A lone commit therefore counts as just the lead-in.

  Uses author dates across all refs (--all) so commits on feature branches and
  every machine are included; merge commits are skipped so they don't double-count.

.EXAMPLE
  pwsh tools/devtime-git.ps1
  pwsh tools/devtime-git.ps1 -GapMinutes 90 -LeadInMinutes 15
  pwsh tools/devtime-git.ps1 -Author 'exzhe'      # only your commits
#>
param(
  # Max pause (minutes) that still counts as the same session.
  [int]$GapMinutes = 60,
  # Minutes credited before the first commit of each session.
  [int]$LeadInMinutes = 10,
  # Optional author filter (substring / regex passed to git --author).
  [string]$Author = ''
)

$ErrorActionPreference = 'Stop'

# Author dates of all non-merge commits across every ref, newest-last.
$gitArgs = @('log', '--all', '--no-merges', '--pretty=format:%aI')
if ($Author) { $gitArgs += "--author=$Author" }

$dates =
  & git @gitArgs |
  Where-Object { $_ } |
  ForEach-Object { [datetimeoffset]::Parse($_).LocalDateTime } |
  Sort-Object -Unique

if (-not $dates) { Write-Host 'No commits found.'; return }
$dates = @($dates)

# Walk sorted commit times, breaking into sessions on gaps > GapMinutes.
$gap  = [timespan]::FromMinutes($GapMinutes)
$lead = [timespan]::FromMinutes($LeadInMinutes)
$sessions = [System.Collections.Generic.List[object]]::new()
$start = $dates[0]; $prev = $dates[0]; $count = 1

function Add-Session($s, $e, $n) {
  $script:sessions.Add([pscustomobject]@{
    Start = $s; End = $e; Commits = $n; Duration = ($e - $s) + $lead
  })
}

for ($i = 1; $i -lt $dates.Count; $i++) {
  $t = $dates[$i]
  if (($t - $prev) -gt $gap) { Add-Session $start $prev $count; $start = $t; $count = 0 }
  $prev = $t; $count++
}
Add-Session $start $prev $count

# Per-day rollup (a session counts toward the day it started).
$byDay = $sessions | Group-Object { $_.Start.ToString('yyyy-MM-dd') } | Sort-Object Name

Write-Host ''
Write-Host 'Development time (from git history)' -ForegroundColor Cyan
$who = if ($Author) { "author~'$Author'" } else { 'all authors' }
Write-Host ("$who   gap: {0} min   lead-in: {1} min" -f $GapMinutes, $LeadInMinutes) -ForegroundColor DarkGray
Write-Host ('-' * 52)

$grand = [timespan]::Zero; $commits = 0
foreach ($day in $byDay) {
  $ticks = 0L; $c = 0
  foreach ($s in $day.Group) { $ticks += $s.Duration.Ticks; $c += $s.Commits }
  $dayTotal = [timespan]::FromTicks($ticks)
  $grand += $dayTotal; $commits += $c
  Write-Host ("{0}   {1,5:F1} h   ({2} sessions, {3} commits)" -f $day.Name, $dayTotal.TotalHours, $day.Count, $c)
}

Write-Host ('-' * 52)
Write-Host ("TOTAL       {0,5:F1} h   ({1} sessions, {2} commits)" -f `
  $grand.TotalHours, $sessions.Count, $commits) -ForegroundColor Green
Write-Host ''
