# Local dev environment for RetireServer.
#
# Usage:
#   1. Copy this file to `dev-env.ps1` (which is gitignored).
#   2. Fill in your actual values below.
#   3. Dot-source it into your PowerShell session BEFORE running mvnw:
#        . .\dev-env.ps1
#      The leading dot + space matters — it loads the variables into
#      your current shell instead of a child process.
#   4. Then:
#        .\mvnw.cmd spring-boot:run
#
# A permanent alternative: set these the same way under Windows
# "Environment Variables" so any PowerShell window inherits them.

# -- Java (only needed if JAVA_HOME isn't set permanently) --
# Point this at YOUR installed JDK (17 or newer). Find it with:
#   (Get-Command java).Source
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-25.0.4.7-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# -- Database (matches docker-compose.yml: MySQL on host port 3307) --
# createDatabaseIfNotExist makes the app create the schema itself.
$env:DB_URL      = "jdbc:mysql://localhost:3307/retirement?createDatabaseIfNotExist=true&allowPublicKeyRetrieval=true&useSSL=false"
$env:DB_USER     = "root"
$env:DB_PASSWORD = "change_me"   # match backend/.env's MYSQL_ROOT_PASSWORD

# -- CORS / frontend origin -----------------------------------
$env:CORS_ALLOWED_ORIGINS = "http://localhost:3000"
