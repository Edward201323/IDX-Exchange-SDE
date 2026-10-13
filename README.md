# IDX Exchange — Weeks 1–4

The backend is implemented through week 4. MySQL runs in Docker; the Express API runs locally on port 5000 and connects to MySQL on port 3306. There is no frontend yet (scheduled for week 5).

## This week's checkpoint: October 12–18, 2026

Week 4 is assumed from the completed Week 3 checkpoint on October 11; the guide does not specify a calendar start date. Both required SQL files, root/backend environment files, environment examples, and the backend dependency lockfile are present. No input files are missing for Weeks 1–4.

New endpoints use **L_ListingID**, not the internal `id` column:

| Request | Successful response |
| --- | --- |
| `GET /api/properties/1111179048` | Full property object |
| `GET /api/properties/1111179048/openhouses` | Array of events, ordered by date, start time, then internal ID |

Unknown listings return `404 {"error":"Property not found"}` on both endpoints. An existing listing with no events returns `200 []`. IDs accept 1–255 letters, digits, underscores, or hyphens; invalid IDs or malformed URL encoding return 400. Database failures return safe JSON with status 500. `all_data` is returned unchanged, including malformed JSON or null values, for defensive frontend handling later.

Every completed request logs a JSON line containing timestamp, method, URL, status, and duration in milliseconds. The open-house route is registered before the detail route. Express matches routes in registration order, although a plain `/:id` route does not itself consume additional `/openhouses` path segments.

Verification on October 12: **133 tests passed**, including real MySQL fixtures for filter combinations, listing lookup, event ordering, and malformed legacy data. Read-only checks confirmed **55,212 properties**, **13,433 open houses**, and successful health, detail, and open-house requests against the imported data. All imported property IDs fit the validation rule. No invalid `all_data` JSON was found in this dataset, so the guide's specific crashing-listing scenario could not be reproduced; regression tests cover malformed data and query rejection without inventing an affected listing.

Run all checks from the project root:

```bash
RUN_MYSQL_TESTS=1 npm test --prefix backend
```

The React `frontend/` is the next milestone, not a missing supplied file. Later deliverables include frontend tests, Maps configuration, a PR template, and presentation materials. Supervisor demos and explaining the code remain personal checkpoints.

### Environment protection

`.gitignore` excludes `.env` and `.env.*` at every directory level, keeping only `.env.example` and `.env.*.example` templates eligible for Git. Templates must contain placeholders only. Raw SQL dumps are also ignored. Verified that root/backend `.env` files and `.env.local`/`.env.production` variants are excluded. The local repository has no commits or tracked files as of this check; nothing was pushed. Remote repository history was not audited. Do not force-add ignored credentials with `git add -f`.

## Start the project

Open Docker Desktop, then run these commands from this project directory:

```bash
bash scripts/setup-db.sh
cd backend
npm run dev
```

Leave that terminal running. Nodemon restarts the API when JavaScript files change. If port 5000 is already occupied by this project's running API, use it instead of starting a second instance.

Dependencies are already installed locally. On a fresh checkout, run `npm ci` inside `backend/`. Copy the root `.env.example` to `.env` and configure your MySQL password; copy `backend/.env.example` to `backend/.env`. The backend reads the existing root password automatically unless `DB_PASSWORD` is set. Never commit either `.env` file.

## See ZIP, beds, baths, and other received data

Open these URLs in your browser while the API is running:

- Health check: <http://localhost:5000/api/health>
- First 20 properties: <http://localhost:5000/api/properties>
- Filtered example: <http://localhost:5000/api/properties?city=Irvine&zipcode=92618&minPrice=300000&beds=3&baths=2&limit=10&offset=0>

The response contains `total`, `limit`, `offset`, and `results`. Each object in `results` contains the database row, using the original RETS column names:

| Meaning | JSON/database field | API filter |
| --- | --- | --- |
| Listing ID | `L_ListingID` | — |
| Address | `L_Address` | — |
| City | `L_City` | `city` |
| State | `L_State` | — |
| ZIP code | `L_Zip` | `zipcode` |
| Price | `L_SystemPrice` | `minPrice`, `maxPrice` |
| Bedrooms | `L_Keyword2` | `beds` |
| Bathrooms | `LM_Dec_3` | `baths` |
| Square feet | `LM_Int2_3` | — |
| Photos | `L_Photos` | — |

`beds` and `baths` mean **at least** the requested number. Price bounds are inclusive. City matching ignores casing and surrounding spaces. ZIP matching is exact; keep ZIPs as strings to preserve leading zeros. Missing source values remain `null`; photos are returned in their stored format.

To print only the fields above in a compact terminal table, run this from any directory while the API is running:

```bash
node - <<'JS'
async function main() {
  const url = 'http://localhost:5000/api/properties?city=Irvine&zipcode=92618&beds=3&baths=2&limit=10';
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  console.log({ total: data.total, limit: data.limit, offset: data.offset });
  console.table(data.results.map(row => ({
    listing: row.L_ListingID,
    city: row.L_City,
    zip: row.L_Zip,
    price: row.L_SystemPrice,
    beds: row.L_Keyword2,
    baths: row.LM_Dec_3,
    sqft: row.LM_Int2_3,
  })));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
JS
```

## Run week 3 SQL inside Docker

Open a second terminal and enter:

```bash
docker exec -it idx-mysql-local mysql -uroot -p rets
```

At the password prompt, enter the `MYSQL_ROOT_PASSWORD` from the root `.env` file. You are now in the MySQL shell inside Docker. Run:

```sql
SHOW TABLES;
DESCRIBE rets_property;
DESCRIBE rets_openhouse;

SELECT COUNT(*) AS properties FROM rets_property;
SELECT COUNT(*) AS open_houses FROM rets_openhouse;

SELECT L_ListingID, L_City, L_Zip,
       L_SystemPrice AS price,
       L_Keyword2 AS beds,
       LM_Dec_3 AS baths,
       LM_Int2_3 AS sqft
FROM rets_property
WHERE LOWER(TRIM(L_City)) = 'irvine'
  AND L_Zip = '92618'
  AND L_Keyword2 >= 3
  AND LM_Dec_3 >= 2
ORDER BY id ASC
LIMIT 10;

SELECT COUNT(*) AS total
FROM rets_property
WHERE LOWER(TRIM(L_City)) = 'irvine'
  AND L_Zip = '92618'
  AND L_Keyword2 >= 3
  AND LM_Dec_3 >= 2;

SHOW INDEXES FROM rets_property;

EXPLAIN SELECT COUNT(*)
FROM rets_property
WHERE LOWER(TRIM(L_City)) = 'irvine'
  AND L_SystemPrice >= 300000;
```

Compare the SQL rows and count with the compact API table above: the filters and ordering are identical. The `EXPLAIN` example should show `idx_search_city_price` in the `key` column. Query plans can vary with the filters and data distribution. Type `exit` to leave MySQL.

## Run the week 3 checks

Run these from `backend/` in another terminal:

```bash
# API tests, including validation, safe errors, and combined-filter bindings
npm test

# Real MySQL tests covering all 64 combinations of the six filters
npm run test:integration

# Check imported table counts, live API behavior, indexes, and EXPLAIN
npm run db:verify

# Create missing search indexes; safe to repeat
npm run db:indexes

# Save query plans and count-plus-page timings before/after index setup
npm run db:benchmark
```

Integration tests use a connection-local temporary table; they do not change imported listings. `npm test` skips those MySQL tests unless `RUN_MYSQL_TESTS=1` is set. To run both suites together:

```bash
RUN_MYSQL_TESTS=1 npm test
```

The benchmark writes a timestamped JSON report under `docs/`. It never removes existing indexes. On this already-indexed database, another run compares the current state against itself. The original before-and-after report is [saved here](docs/query-performance-2026-10-11T18-10-48-022Z.json).

## Validation rules

- `limit`: integer 1–100; default 20.
- `offset`: integer 0–2,147,483,647; default 0.
- `city`: nonempty, at most 50 characters, no control characters.
- `zipcode`: five digits or ZIP+4, such as `92618` or `92618-1234`.
- `minPrice`, `maxPrice`: 0–2,147,483,647, at most two decimal places; minimum cannot exceed maximum.
- `beds`: integer 0–1,000.
- `baths`: 0–999.9, at most one decimal place.
- Unknown, repeated, empty, or malformed parameters return HTTP 400 with an explanation.

Try <http://localhost:5000/api/properties?minPrice=abc> or <http://localhost:5000/api/properties?limit=200> to see validation errors.

## Verified results

On October 11, 2026:

- MySQL contained **55,212 properties** and **13,433 open houses**.
- **103 tests passed**, including real MySQL tests for every filter combination.
- The live health endpoint returned `{"status":"ok","database":"connected"}`.
- `city=Irvine&minPrice=300000&beds=3` returned **548 matching listings**.
- Index creation and a second, idempotent migration both passed.
- The city/price/beds benchmark's median count-plus-page time fell from approximately **432 ms to 3.8 ms**. These local measurements include client overhead and depend on cache state; they are not production performance guarantees.

The imported schema has a legacy zero-date default. The migration temporarily permits that default on its own connection and restores the original SQL mode afterward.

The dependency audit reported no production vulnerabilities at installation. Development dependencies reported 22 findings (19 moderate, 3 high); the suggested automatic remedies included major downgrades, which were not applied.

## Files to review

- `backend/src/routes/properties.js`: count and paginated property queries.
- `backend/src/search.js`: parameter validation and shared filter construction.
- `backend/src/app.js`: health check, routing, and error responses.
- `backend/src/db.js`: reusable MySQL connection pool.
- `backend/scripts/indexes.js`: normalized-city/price, price, beds, and baths indexes; existing ZIP index reused.
- `backend/test/api.test.js`: API behavior and combined price/beds regression test.
- `backend/test/mysql.test.js`: independent expected results against real MySQL.

For a fresh database only, place the provided dumps under `sql/`, run `bash scripts/setup-db.sh`, then `bash scripts/import-db.sh` from the project root. The importer skips existing tables to preserve their data. Both required tables are already populated on this machine.

Implementation references: [MySQL2 documentation](https://sidorares.github.io/node-mysql2/docs), [Express error handling](https://expressjs.com/en/guide/error-handling/), and [MySQL index documentation](https://dev.mysql.com/doc/refman/8.0/en/create-index.html).
