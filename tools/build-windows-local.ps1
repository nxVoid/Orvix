param(
    [Parameter(Mandatory = $true)][string]$SourceArchive,
    [Parameter(Mandatory = $true)][string]$RendererArchive,
    [string]$BuildRoot = "$env:LOCALAPPDATA\RelayBuild",
    [string]$Version = '2026.1107.1'
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $BuildRoot 'source'
$logs = Join-Path $BuildRoot 'logs'
New-Item -ItemType Directory -Force $source, $logs | Out-Null
$env:PATH = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_BUILD_JOBS = '1'
$env:CARGO_PROFILE_DEV_DEBUG = '0'
$env:BUILD_CHANNEL = 'stable'
$env:BUILD_VERSION = $Version
$env:ELECTRON_ARCH = 'x64'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:ORVIX_OFFLINE = '1'
$env:WORKDIR = $source
$env:pnpm_config_verify_deps_before_run = 'false'
$env:CI = 'true'

function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    Write-Host ('> ' + $Program + ' ' + ($Arguments -join ' '))
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Program" }
}

Start-Transcript -Path (Join-Path $logs 'windows-build.log') -Force
try {
    $archive = Join-Path $BuildRoot 'source.tar.gz'
    Copy-Item -LiteralPath $SourceArchive -Destination $archive -Force
    Invoke-Checked 'tar.exe' @('-xf', $archive, '-C', $source)
    Set-Location $source
    Invoke-Checked 'pnpm.cmd' @('install', '--frozen-lockfile', '--ignore-scripts')
    Invoke-Checked 'cargo.exe' @('build', '-p', 'relay-ci', '--no-default-features', '--locked')
    $env:ORVIX_CI_BIN = Join-Path $source 'target\debug\relay-ci.exe'
    $renderer = Join-Path $source 'relay_desktop\dist\renderer'
    New-Item -ItemType Directory -Force $renderer | Out-Null
    $rendererTar = Join-Path $BuildRoot 'renderer.tar.gz'
    Copy-Item -LiteralPath $RendererArchive -Destination $rendererTar -Force
    Invoke-Checked 'tar.exe' @('-xf', $rendererTar, '-C', $renderer)
    Set-Location (Join-Path $source 'relay_desktop')
    $env:NODE_ENV = 'production'
    Invoke-Checked 'node.exe' @('scripts/build.mjs', '--use-shared-renderer')
    Invoke-Checked 'pnpm.cmd' @('exec', 'tsc', '--noEmit')
    Invoke-Checked 'pnpm.cmd' @('exec', 'electron-builder', '--win', 'dir', '--x64', '--publish', 'never',
        '--config', 'electron-builder.config.cjs', "-c.extraMetadata.version=$Version")
    $exe = Join-Path $source 'relay_desktop\dist-electron\win-unpacked\Relay.exe'
    if (!(Test-Path -LiteralPath $exe)) { throw "Expected executable was not generated: $exe" }
    Set-Content -Path (Join-Path $BuildRoot 'windows-build.exit') -Value '0'
    Write-Host "Relay executable: $exe"
} catch {
    Set-Content -Path (Join-Path $BuildRoot 'windows-build.exit') -Value '1'
    throw
} finally {
    Stop-Transcript
}
