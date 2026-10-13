#!/usr/bin/env bash
# Imports sql/rets_property.sql and sql/rets_openhouse.sql into the rets database.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo 'Missing .env: copy .env.example and configure credentials.' >&2; exit 1; }
set -a; source .env; set +a
: "${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD in .env}"
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE in .env}"

mysql_local() {
  docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" idx-mysql-local mysql -uroot "$MYSQL_DATABASE" "$@"
}

# Preflight both files before changing either table.
for table in rets_property rets_openhouse; do
  [ -f "sql/$table.sql" ] || { echo "Missing sql/$table.sql — download the provided SQL file first." >&2; exit 1; }
done

for table in rets_property rets_openhouse; do
  file="sql/$table.sql"
  exists=$(mysql_local -Nse "SHOW TABLES LIKE '$table'")
  if [ -n "$exists" ]; then
    echo "$table already exists; leaving its data unchanged."
    continue
  fi
  echo "Importing $file ..."
  # -i lets docker exec read the file from stdin.
  mysql_local < "$file"
done

mysql_local -e "
  SHOW TABLES;
  SELECT COUNT(*) AS rets_property_rows FROM rets_property;
  SELECT COUNT(*) AS rets_openhouse_rows FROM rets_openhouse;"

for table in rets_property rets_openhouse; do
  count=$(mysql_local -Nse "SELECT COUNT(*) FROM $table")
  [ "$count" -gt 0 ] || { echo "$table is empty; inspect the import error before retrying." >&2; exit 1; }
done
