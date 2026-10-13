#!/usr/bin/env bash
# Creates the idx-mysql-local MySQL 8 container (idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo 'Missing .env: copy .env.example and set your database password.' >&2; exit 1; }
set -a; source .env; set +a
: "${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD in .env}"
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE in .env}"
docker info >/dev/null 2>&1 || { echo 'Start Docker Desktop before running this script.' >&2; exit 1; }

if docker ps -a --format '{{.Names}}' | grep -qx idx-mysql-local; then
  echo "Container idx-mysql-local already exists; starting it."
  docker start idx-mysql-local >/dev/null
else
  # -v keeps data in a named volume so it survives container removal.
  docker run -d \
    --name idx-mysql-local \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    -p 127.0.0.1:3306:3306 \
    -v idx-mysql-data:/var/lib/mysql \
    mysql:8 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci >/dev/null
fi

echo -n "Waiting for MySQL to accept connections"
attempts=0
until docker exec -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" idx-mysql-local mysql -uroot -e 'SELECT 1' >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo ' timed out. Check docker logs idx-mysql-local and the credentials in .env.' >&2
    exit 1
  fi
  echo -n "."; sleep 2
done
echo " ready."
