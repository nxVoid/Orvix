param(
    [Parameter(Mandatory = $true)][string]$SourceArchive,
    [Parameter(Mandatory = $true)][string]$RendererArchive,
    [Parameter(Mandatory = $true)][string]$BuildRoot,
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Destination = "$env:USERPROFILE\Desktop"
)

# Local, unsigned installer only. The signed CI/Velopack release path is unchanged.
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $BuildRoot) { throw "Refusing to overwrite an existing build: $BuildRoot" }
$source = Join-Path $BuildRoot 'source'
$logs = Join-Path $BuildRoot 'logs'
New-Item -ItemType Directory -Path $source, $logs | Out-Null
$env:PATH = "$env:ProgramFiles\nodejs;$env:APPDATA\npm;$env:USERPROFILE\.cargo\bin;$env:PATH"
$env:CARGO_BUILD_JOBS = '1'
$env:CMAKE_BUILD_PARALLEL_LEVEL = '1'
$env:CARGO_PROFILE_DEV_DEBUG = '0'
$env:BUILD_CHANNEL = 'stable'
$env:BUILD_VERSION = $Version
$env:ELECTRON_ARCH = 'x64'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:ORVIX_OFFLINE = '1'
$env:ORVIX_MODULES = ''
$env:WORKDIR = $source
$env:pnpm_config_verify_deps_before_run = 'false'
$env:CI = 'true'
$env:NODE_OPTIONS = '--max-old-space-size=3072'
$env:RAYON_NUM_THREADS = '2'
$env:TOKIO_WORKER_THREADS = '2'

function Quote-NativeArgument([string]$Value) {
    return '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

function Invoke-Checked([string]$Stage, [string]$Program, [string[]]$Arguments, [int]$TimeoutSeconds = 1800, [int]$AllowedExitCode = 0) {
    Set-Content -LiteralPath (Join-Path $BuildRoot 'stage.txt') -Value $Stage
    Write-Host "[$(Get-Date -Format o)] $Stage"
    $executable = (Get-Command $Program -ErrorAction Stop).Source
    $argumentText = (($Arguments | ForEach-Object { Quote-NativeArgument $_ }) -join ' ')
    if ([IO.Path]::GetExtension($executable) -eq '.cmd') {
        $argumentText = '/d /s /c "' + (Quote-NativeArgument $executable) + ' ' + $argumentText + '"'
        $executable = $env:ComSpec
    }
    $outLog = Join-Path $logs "$Stage.stdout.log"
    $errLog = Join-Path $logs "$Stage.stderr.log"
    $process = Start-Process -FilePath $executable -ArgumentList $argumentText -WorkingDirectory (Get-Location).Path -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $ownedProcessHandle = $process.Handle
    if (!$process.WaitForExit($TimeoutSeconds * 1000)) {
        & taskkill.exe /PID $process.Id /T /F | Out-Null
        throw "Stage timed out: $Stage ($TimeoutSeconds seconds). Logs: $logs"
    }
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    if ($null -eq $exitCode) { throw "Cannot obtain exit code for $Stage" }
    Add-Content -LiteralPath (Join-Path $BuildRoot 'stage-results.tsv') -Value "$Stage`t$exitCode"
    if ($exitCode -lt 0 -or $exitCode -gt $AllowedExitCode) {
        Get-Content -LiteralPath $errLog -Tail 35 | Write-Host
        Get-Content -LiteralPath $outLog -Tail 20 | Write-Host
        throw "Stage failed: $Stage (exit $exitCode)"
    }
}

Start-Transcript -Path (Join-Path $logs 'build-transcript.log') | Out-Null
try {
    Copy-Item -LiteralPath $SourceArchive -Destination (Join-Path $BuildRoot 'source.tar.gz')
    Copy-Item -LiteralPath $RendererArchive -Destination (Join-Path $BuildRoot 'renderer.tar.gz')
    Invoke-Checked 'extract-source' 'tar.exe' @('-xf', (Join-Path $BuildRoot 'source.tar.gz'), '-C', $source) 180
    Set-Location $source
    $oldTarget = Join-Path $env:LOCALAPPDATA 'OrvixBuild\source\target'
    if (Test-Path -LiteralPath $oldTarget) {
        # Copy reusable build outputs; never write into or remove the earlier build.
        Invoke-Checked 'copy-ci-cache' 'robocopy.exe' @($oldTarget, (Join-Path $source 'target'), '/E', '/COPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS') 600 7
    }
    Invoke-Checked 'install-dependencies' 'pnpm.cmd' @('install', '--frozen-lockfile', '--ignore-scripts', '--child-concurrency=1', '--network-concurrency=4') 900
    Invoke-Checked 'build-ci-helper' 'cargo.exe' @('build', '-p', 'relay-ci', '--no-default-features', '--locked', '-j', '1') 1800
    $env:ORVIX_CI_BIN = Join-Path $source 'target\debug\relay-ci.exe'
    $env:CARGO_TARGET_DIR = Join-Path $BuildRoot 'native-target'
    $renderer = Join-Path $source 'relay_desktop\dist\renderer'
    New-Item -ItemType Directory -Path $renderer -Force | Out-Null
    Invoke-Checked 'extract-renderer' 'tar.exe' @('-xf', (Join-Path $BuildRoot 'renderer.tar.gz'), '-C', $renderer) 180
    Set-Location (Join-Path $source 'relay_desktop')
    $env:NODE_ENV = 'production'
    Invoke-Checked 'build-desktop-and-native' 'node.exe' @('scripts/build.mjs', '--use-shared-renderer') 3600
    Invoke-Checked 'typecheck-desktop' 'pnpm.cmd' @('exec', 'tsc', '--noEmit') 180
    $config = @'
const base = require('./electron-builder.config.cjs');
module.exports = {
  ...base,
  publish: null,
  win: {...base.win, target: [{target: 'nsis', arch: ['x64']}]},
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: 'Relay',
    artifactName: 'Relay-${version}-win-${arch}-Setup.${ext}'
  }
};
'@
    $localConfig = Join-Path (Get-Location).Path 'electron-builder.local-installer.cjs'
    [IO.File]::WriteAllText($localConfig, $config, [Text.UTF8Encoding]::new($false))
    Invoke-Checked 'package-nsis-installer' 'pnpm.cmd' @('exec', 'electron-builder', '--win', 'nsis', '--x64', '--publish', 'never', '--config', $localConfig, "-c.extraMetadata.version=$Version") 1200
    $exe = Join-Path $source 'relay_desktop\dist-electron\win-unpacked\Relay.exe'
    $installerName = "Relay-$Version-win-x64-Setup.exe"
    $installer = Join-Path $source "relay_desktop\dist-electron\$installerName"
    if (!(Test-Path -LiteralPath $exe)) { throw "Missing Relay executable: $exe" }
    if (!(Test-Path -LiteralPath $installer)) { throw "Missing installer: $installer" }
    $stream = [IO.File]::OpenRead($exe)
    try {
        $reader = New-Object IO.BinaryReader($stream)
        if ($reader.ReadUInt16() -ne 0x5A4D) { throw 'Application has no PE header' }
        $stream.Position = 0x3c
        $pe = $reader.ReadInt32()
        $stream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x4550) { throw 'Invalid PE signature' }
        if ($reader.ReadUInt16() -ne 0x8664) { throw 'Application is not Windows x64' }
    } finally { $stream.Dispose() }
    $info = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
    if ($info.ProductName -ne 'Relay') { throw "Unexpected product name: $($info.ProductName)" }
    $destinationFile = Join-Path $Destination $installerName
    if ((Test-Path -LiteralPath $destinationFile) -or (Test-Path -LiteralPath ($destinationFile + '.sha256'))) {
        $destinationFile = Join-Path $Destination ("Relay-$Version-win-x64-Setup-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.exe')
    }
    [IO.File]::Copy($installer, $destinationFile, $false)
    $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    if ((Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw 'Desktop copy checksum mismatch' }
    [IO.File]::WriteAllText(($destinationFile + '.sha256'), ($hash + '  ' + [IO.Path]::GetFileName($destinationFile) + "`n"), [Text.UTF8Encoding]::new($false))
    $report = [ordered]@{product='Relay';version=$Version;platform='win32';arch='x64';installer='NSIS';signed=$false;source=$source;application=$exe;destination=$destinationFile;sha256=$hash;bytes=(Get-Item -LiteralPath $destinationFile).Length;productName=$info.ProductName;productVersion=$info.ProductVersion;autoUpdatesEnabled=$false;published=$false}
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $BuildRoot 'build-report.json')
    Set-Content -LiteralPath (Join-Path $BuildRoot 'build.exit') -Value '0'
    Set-Content -LiteralPath (Join-Path $BuildRoot 'stage.txt') -Value 'complete'
    Write-Host "INSTALLER=$destinationFile"
    Write-Host "SHA256=$hash"
} catch {
    $_ | Out-String | Write-Host
    Set-Content -LiteralPath (Join-Path $BuildRoot 'build.exit') -Value '1'
    Set-Content -LiteralPath (Join-Path $BuildRoot 'failure.txt') -Value ($_ | Out-String)
    throw
} finally {
    Stop-Transcript | Out-Null
}
