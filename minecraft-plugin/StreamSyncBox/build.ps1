# Compila StreamSyncBox contra la API de Paper usando el JDK incluido con el servidor.
# Uso: powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$srv = "C:\Users\Usuario\AppData\Roaming\.minecraft\minecraftServer"
$javac = Join-Path $srv "jdk-21.0.7-lite\bin\javac.exe"
$jarTool = Join-Path $srv "jdk-21.0.7-lite\bin\jar.exe"
$api = Join-Path $srv "versions\1.21\paper-1.21.jar"

$out = Join-Path $root "build\classes"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out | Out-Null

$srcFiles = Get-ChildItem (Join-Path $root "src") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& $javac -cp $api -d $out $srcFiles
if ($LASTEXITCODE -ne 0) { throw "javac falló" }

Copy-Item (Join-Path $root "src\plugin.yml") $out -Force
$jarPath = Join-Path $root "StreamSyncBox.jar"
& $jarTool cf $jarPath -C $out .
if ($LASTEXITCODE -ne 0) { throw "jar falló" }

Write-Output "OK -> $jarPath ($([math]::Round((Get-Item $jarPath).Length/1KB,1)) KB)"
