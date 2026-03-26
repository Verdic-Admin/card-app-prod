# ---------------------------------------------------------
# NotebookLM Packer Script (Entire Workspace - Unbundled)
# ---------------------------------------------------------
# Scans all active workspace folders and copies files 
# to individual .txt files with path-encoded filenames.
# ---------------------------------------------------------

$OutputDir = "d:\notebooklm_sources"

$Workspaces = @(
    "d:\card-app-prod",
    "d:\fintech-api",
    "d:\player-index-prod",
    "d:\scan-api"
)

$IncludeExtensions = @(".md", ".txt", ".yaml", ".json", ".sql", ".ps1", ".ts", ".tsx", ".js", ".cjs", ".mjs", ".css", ".py", ".dart")
$IgnorePatterns = @(
    "*.git*", "*notebooklm_sources*", "*node_modules*", "*.next*", "*__pycache__*", "*.venv*", "*.env*", "*dist*", "*build*", "*.supabase*", "*.dart_tool*"
)

Write-Host "Resetting $OutputDir..."
if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Test-IsIgnored ($Path) {
    foreach ($pattern in $IgnorePatterns) { if ($Path -like $pattern) { return $true } }
    return $false
}

$TotalFilesProcessed = 0

foreach ($Workspace in $Workspaces) {
    if (-not (Test-Path $Workspace)) {
        Write-Warning "Workspace not found: $Workspace"
        continue
    }

    $WorkspaceName = (Get-Item $Workspace).Name
    Write-Host "Scanning Workspace: $Workspace..."
    
    $Files = Get-ChildItem -Path $Workspace -Recurse -File

    foreach ($File in $Files) {
        $DisplayPath = $File.FullName.Substring($Workspace.Length + 1).Replace("\", "/")
        $RelPath = "$WorkspaceName/$DisplayPath"
        
        # 1. Check Ignore Patterns
        if (Test-IsIgnored $RelPath) { continue }

        # 2. Check Extension
        $Ext = $File.Extension
        if ($Ext) { 
            if ($IncludeExtensions -notcontains $Ext) { continue } 
        }
        else {
            if ($IncludeExtensions -notcontains $File.Name) { continue }
        }

        # 3. Generate Flattened Name
        $SafeName = $RelPath -replace '[\\/]', '__'
        $DestName = "$SafeName.txt"
        $DestPath = Join-Path $OutputDir $DestName

        try {
            # 4. Copy Content
            $Content = Get-Content -LiteralPath $File.FullName -Raw -ErrorAction Stop
            
            $ContentWithHeader = "--- SOURCE: $RelPath ---`n`n$Content"
            Set-Content -Path $DestPath -Value $ContentWithHeader -Encoding UTF8
            
            $TotalFilesProcessed++
        }
        catch {
            # Silently ignore permission errors
        }
    }
}

Write-Host "✅ Processing Complete!"
Write-Host "Generated $TotalFilesProcessed individual txt files in $OutputDir"
