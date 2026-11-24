# Relay only. Run in an Administrator PowerShell. Undo with -Undo.
[CmdletBinding()]
param([switch]$Undo, [string]$InterfaceAlias = 'Wi-Fi')
$ErrorActionPreference = 'Stop'
$ruleNames = @('Relay-Dev-LAN-TCP', 'Relay-Dev-LAN-UDP')
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an Administrator PowerShell.'
}
if ($Undo) {
    foreach ($name in $ruleNames) {
        Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    }
    Write-Output 'Removed only the Relay development LAN firewall rules.'
    return
}
$profile = Get-NetConnectionProfile -InterfaceAlias $InterfaceAlias
if ($profile.NetworkCategory -ne 'Private') {
    throw 'The selected interface must already be Private. This script does not change network profiles.'
}
$address = Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 |
    Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
if (-not $address) { throw 'No active IPv4 address on the selected interface.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
foreach ($name in $ruleNames) {
    if (Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue) {
        throw "Rule $name already exists. Inspect it or use -Undo before applying again."
    }
}
try {
    New-NetFirewallRule -Name $ruleNames[0] -DisplayName 'Relay development LAN TCP' `
        -Direction Inbound -Action Allow -Profile Private -InterfaceAlias $InterfaceAlias `
        -Program $node -Protocol TCP -LocalAddress $address -LocalPort 18088,7881 `
        -RemoteAddress LocalSubnet | Out-Null
    New-NetFirewallRule -Name $ruleNames[1] -DisplayName 'Relay development LAN UDP' `
        -Direction Inbound -Action Allow -Profile Private -InterfaceAlias $InterfaceAlias `
        -Program $node -Protocol UDP -LocalAddress $address -LocalPort 7882 `
        -RemoteAddress LocalSubnet | Out-Null
} catch {
    foreach ($name in $ruleNames) {
        Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    }
    throw
}
Write-Output "Relay LAN rules enabled on $InterfaceAlias ($address), Private/LocalSubnet only."
Write-Output "Phone URL: http://${address}:18088"
