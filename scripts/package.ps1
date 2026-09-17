$ErrorActionPreference = 'Stop'
node scripts/build.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build failed; archive not created.' }
node --test tests/*.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Verification failed; archive not created.' }
Compress-Archive -Path 'dist/*' -DestinationPath 'garupa-song-atlas.zip' -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) 'garupa-song-atlas.zip'))
try {
    if (-not ($archive.Entries | Where-Object FullName -eq 'index.html')) { throw 'Archive root index missing.' }
    if (-not ($archive.Entries | Where-Object FullName -eq 'songs.json')) { throw 'Catalog missing from archive.' }
    Write-Output "Public archive verified: $($archive.Entries.Count) entries."
} finally { $archive.Dispose() }
Get-FileHash -Algorithm SHA256 -LiteralPath 'garupa-song-atlas.zip'
