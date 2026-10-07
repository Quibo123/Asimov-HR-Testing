param(
  [Parameter(Mandatory)][string]$WebUrl,
  [Parameter(Mandatory)][string]$ApiUrl
)

$WebUrl = $WebUrl.TrimEnd('/')
$ApiUrl = $ApiUrl.TrimEnd('/')
$failed = 0

function Check($name, $url, $test) {
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200 -and (& $test $r)) {
      Write-Host "PASS  $name"
    } else {
      Write-Host "FAIL  $name (status $($r.StatusCode), unexpected content)"
      $script:failed++
    }
  } catch {
    Write-Host "FAIL  $name : $($_.Exception.Message)"
    $script:failed++
  }
}

Check 'Web app loads'        "$WebUrl/"        { param($r) $r.Content -match '<div id="root">' }
Check 'Careers page loads'   "$WebUrl/careers" { param($r) $r.Content -match '<div id="root">' }
Check 'Public jobs API'      "$ApiUrl/public/jobs" {
  param($r)
  $jobs = $r.Content | ConvertFrom-Json
  $null -ne $jobs
}

if ($failed -gt 0) { Write-Host "`n$failed check(s) failed"; exit 1 }
Write-Host "`nAll checks passed"