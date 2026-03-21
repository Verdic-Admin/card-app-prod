# ---------------------------------------------------------
# NotebookLM Packer Script (Refined Paths)
# ---------------------------------------------------------
# Copies files to .txt with path-encoded filenames.
# Now supports explicit file/folder inclusion lists.
# ---------------------------------------------------------

$SourceRoot = Get-Location
$OutputDir = Join-Path $SourceRoot "notebooklm_sources"

# --- CONFIGURATION ---
# Specific paths to include (File or Directory)
$IncludePaths = @(
    "."
)

$IncludeExtensions = @(".ts", ".tsx", ".css", ".py", ".md", ".txt", ".json", ".yaml", ".env", ".gitignore")
$IgnorePatterns = @(
    "*venv*", "*__pycache__*", "*.git*", "*node_modules*", "*.next*",
    "*.csv", "*.png", "*.jpg", "*.svg", "mock_*", "build", "dist", 
    "*.ico", "*.cur", "*notebooklm_sources*"
)

# --- RESET & EXECUTE ---
Write-Host "Resetting $OutputDir..."
if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Test-IsIgnored ($Path) {
    foreach ($pattern in $IgnorePatterns) { if ($Path -like $pattern) { return $true } }
    return $false
}

function Get-DisplayPath ($FullPath) {
    return $FullPath.Replace($SourceRoot.Path + "\", "").Replace("\", "/")
}

$TotalFiles = 0

foreach ($RelPath in $IncludePaths) {
    $FullPath = Join-Path $SourceRoot $RelPath
    
    if (-not (Test-Path $FullPath)) {
        Write-Warning "Path not found: $RelPath"
        continue
    }

    if ((Get-Item $FullPath).PSIsContainer) {

        Write-Host "Scanning Dir: $RelPath..."
        $Files = Get-ChildItem -Path $FullPath -Recurse -File
    }
    else {
        Write-Host "Processing File: $RelPath..."
        $Files = @((Get-Item $FullPath))
    }

    foreach ($File in $Files) {
        $DisplayPath = Get-DisplayPath $File.FullName
        
        # 1. Check Ignore Patterns
        if (Test-IsIgnored $DisplayPath) { continue }

        # 2. Check Extension (only if directory scan, implicit for explicit file)
        # Actually, let's enforce extension check for everything to be safe, 
        # unless it is the explicit pubspec.yaml which is in extensions list anyway.
        $Ext = $File.Extension
        if ($Ext) { 
            if ($IncludeExtensions -notcontains $Ext) { continue } 
        }
        else {
            if ($IncludeExtensions -notcontains $File.Name) { continue }
        }

        # 3. Generate Flattened Name
        $SafeName = $DisplayPath -replace '[\\/]', '__'
        $DestName = "$SafeName.txt"
        $DestPath = Join-Path $OutputDir $DestName

        try {
            # 4. Copy Content
            $Content = Get-Content -LiteralPath $File.FullName -Raw -ErrorAction Stop
            $ContentWithHeader = "--- SOURCE: $DisplayPath ---`n`n$Content"
            
            Set-Content -Path $DestPath -Value $ContentWithHeader -Encoding UTF8
            $TotalFiles++
        }
        catch {
            Write-Warning "Failed to process $DisplayPath : $_"
        }
    }
}

Write-Host "✅ Processing Complete!"
Write-Host "Generated $TotalFiles files in $OutputDir"
