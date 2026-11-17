# T3 Code — Matrix Rain Animated Theme Installer (PowerShell)
param(
    [switch]$Remove
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($Remove) {
    node (Join-Path $ScriptDir "install.mjs") --remove
} else {
    node (Join-Path $ScriptDir "install.mjs")
}
