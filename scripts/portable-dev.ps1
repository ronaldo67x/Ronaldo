param(
  [string]$NodeVersion = "22.14.0",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$portableRoot = Join-Path $root ".portable"
$nodeDir = Join-Path $portableRoot ("node-v{0}-win-x64" -f $NodeVersion)
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"

New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

# Ensure portable Node is used by npm and all postinstall scripts (e.g. esbuild).
$env:PATH = "$nodeDir;" + $env:PATH
$env:npm_config_scripts_prepend_node_path = "true"

if (-not (Test-Path $nodeExe)) {
  $zipName = "node-v{0}-win-x64.zip" -f $NodeVersion
  $zipPath = Join-Path $portableRoot $zipName
  $url = "https://nodejs.org/dist/v{0}/{1}" -f $NodeVersion, $zipName

  Write-Host "Downloading portable Node.js v$NodeVersion ..."
  Invoke-WebRequest -Uri $url -OutFile $zipPath

  Write-Host "Extracting $zipName ..."
  Expand-Archive -Path $zipPath -DestinationPath $portableRoot -Force
}

if (-not (Test-Path $npmCmd)) {
  throw "npm.cmd was not found in $nodeDir"
}

if (-not $SkipInstall) {
  Write-Host "Installing dependencies in project (portable Node/npm) ..."
  try {
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  }
  catch {
    Write-Host "First npm install failed. Cleaning node_modules and retrying once ..."
    $nodeModules = Join-Path $root "node_modules"
    if (Test-Path $nodeModules) {
      Remove-Item -Recurse -Force $nodeModules -ErrorAction SilentlyContinue
    }
    & $npmCmd install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed after retry" }
  }
}

Write-Host "Building @ronaldo/shared so Vite can resolve workspace package entry ..."
& $npmCmd run build --workspace @ronaldo/shared
if ($LASTEXITCODE -ne 0) { throw "shared package build failed" }

Write-Host "Starting API on http://localhost:4000 ..."
$api = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$npmCmd`" run dev --workspace @ronaldo/api" -WorkingDirectory $root -PassThru

try {
  Write-Host "Starting Web on http://localhost:5173 ..."
  & $npmCmd run dev
}
finally {
  if ($api -and -not $api.HasExited) {
    Write-Host "Stopping API process ..."
    Stop-Process -Id $api.Id -Force
  }
}
