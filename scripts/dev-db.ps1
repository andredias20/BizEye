$ErrorActionPreference = 'Stop'

docker compose up -d db
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

docker compose run --rm migrate
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
