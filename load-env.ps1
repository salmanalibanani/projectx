# Loads variables from a .env file into the current PowerShell session.
#
# Usage:
#   . .\load-env.ps1
#
# Optional:
#   . .\load-env.ps1 -EnvFile ".env.local"
#
# Important:
#   Use dot-sourcing with the leading ". ".
#   If you run this script without dot-sourcing, the variables will only exist
#   inside the script process and will not remain in your current session.
#
# This script is safe to commit because it does not contain secrets.
# Secrets are read from the local .env file, which should not be committed.

param(
    [string]$EnvFile = ".env"
)

if (-not (Test-Path $EnvFile)) {
    Write-Error "Env file not found: $EnvFile"
    return
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()

    if ([string]::IsNullOrWhiteSpace($line)) {
        return
    }

    if ($line.StartsWith("#")) {
        return
    }

    $parts = $line -split "=", 2

    if ($parts.Count -ne 2) {
        return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()

    if ([string]::IsNullOrWhiteSpace($name)) {
        return
    }

    if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
}

Write-Host "Loaded environment variables from $EnvFile"