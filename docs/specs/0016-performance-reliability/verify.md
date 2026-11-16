# Verify: performance & reliability · spec 0016 · updated 2026-11-16

_Evidence log for spec 0016. Every performance step adds its numbers here before it is kept or reverted (AC-4). `/check verify` reads this file._

## Baseline (AC-3)

**Taken**: 2026-11-16, 08:18 to 08:25 UTC (warm) · **Commit**: `eabd7aa` (instrumentation only, no fix applied) · **API**: `https://eneba-api.onrender.com` · **Client side**: one machine in Vilnius (Cloudflare edge `VNO`), `curl 8.7.1`, HTTP/2 through Cloudflare.

### Runtime facts

| Fact | Value | Source |
|---|---|---|
| Render service, region | `eneba-api`, Frankfurt (EU Central) | Render dashboard |
| Instance | 0.15 CPU, 512 MB RAM (free) | Render dashboard |
| `PHP_OPCACHE_ENABLE` | unset in Render, so the image default `0`: **OPcache off** (`opcache.enable => Off`) | Render env; image env and `php -i` |
| Laravel caches | config, routes, events, views built in the deploy log | Render deploy log |
| PHP FPM | `pm = ondemand`, `pm.max_children = 20`, `pm.start_servers = 0`, `pm.max_requests = 0`, from the image env (`PHP_FPM_PM_*`) read by `docker-php-serversideup-pool.conf` | `php-fpm -tt` in `serversideup/php:8.4-fpm-nginx` (PHP 8.4.27, local pull of 2026-11-10; the tag is not pinned, so Render's build can be slightly newer) |
| App cache and limiter store | `CACHE_STORE=database`, limiter on the same store | spec 0016 AC-5 |

### Warm runs, 10 per mode

All 150 calls answered 200. Milliseconds. `app` and `db` come from `Server-Timing` (AC-1).

**`--waterfall`** (the client today: `/home`, then four at once), 08:18 UTC

| call | median ttfb | median total | max total | median app | median db |
|---|---:|---:|---:|---:|---:|
| `/home` | 842.4 | 842.8 | 1420.7 | 631.7 | 156.5 |
| `/home/banners` | 4575.0 | 4578.7 | 5017.5 | 4430.5 | 830.0 |
| `/home/best-sellers` | 4196.8 | 4245.8 | 5017.4 | 3974.6 | 828.2 |
| `/home/deals` | 4320.7 | 4390.8 | 5530.4 | 4149.1 | 598.6 |
| `/products` | 4723.6 | 4768.2 | 5745.3 | 4619.9 | 787.2 |
| **run finish** | | **5722.5** | **6631.0** | | |

**`--parallel`** (all five at once), 08:21 UTC

| call | median ttfb | median total | max total | median app | median db |
|---|---:|---:|---:|---:|---:|
| `/home` | 5017.9 | 5018.2 | 5934.8 | 4839.2 | 977.0 |
| `/home/banners` | 5473.5 | 5519.6 | 6447.5 | 5355.6 | 1223.2 |
| `/home/best-sellers` | 5520.2 | 5560.3 | 6058.6 | 5275.6 | 875.7 |
| `/home/deals` | 5311.6 | 5351.5 | 6069.0 | 5145.8 | 1002.8 |
| `/products` | 5629.9 | 5670.1 | 6693.7 | 5533.4 | 945.6 |
| **run finish** | | **5679.5** | **6693.7** | | |

**`--serial`** (one after another: the cost of each call alone), 08:23 UTC

| call | median ttfb | median total | max total | median app | median db |
|---|---:|---:|---:|---:|---:|
| `/home` | 921.7 | 922.0 | 1634.7 | 728.7 | 122.7 |
| `/home/banners` | 1008.8 | 1011.0 | 2239.7 | 823.2 | 147.8 |
| `/home/best-sellers` | 1034.2 | 1036.3 | 1532.4 | 802.6 | 137.4 |
| `/home/deals` | 1004.6 | 1006.7 | 1698.8 | 805.0 | 122.8 |
| `/products` | 1128.7 | 1132.4 | 1673.8 | 883.1 | 150.6 |
| **run finish** | | **5577.3** | **6385.7** | | |

**Query count per call** (one call each, 08:25 UTC): `/home` 7, `/home/banners` 10, `/home/best-sellers` 9, `/home/deals` 9, `/products` 10. The deploy check earlier the same morning saw `/home` at 11. The `/home` action itself runs exactly 1 query (pinned by `HomeLayoutTest`, "loads the layout in one query", on the `array` cache), so the other 6 to 10 come from outside the action: the `catalog` rate limiter reading and writing its counter in the `database` cache store.

### What the baseline shows

1. **The three modes finish in the same time.** Waterfall 5.72 s, parallel 5.68 s, and serial 5.58 s. Running the calls at the same time saves nothing, and this is the signature of a throughput limit: the server can only do about 1.1 s of work per call, whatever the order.
2. **The waiting happens inside PHP, not in front of it.** `LARAVEL_START` is set once FPM has handed the request to a worker, so `app` excludes time spent queued for a worker. Across the per call medians of all three modes, ttfb minus `app` stays between about 100 and 250 ms (97 to 246 ms), and it does not grow when calls run together (serial `/home`: 921.7 − 728.7 = 193 ms; parallel `/home`: 5017.9 − 4839.2 = 179 ms). So requests are not waiting for a free FPM worker; there are 20 and only 5 are needed. Instead each concurrent request runs about 5 times slower: one call's `app` is about 0.8 s alone and about 5.3 s when five run together. Five workers sharing 0.15 CPU explains exactly that. The feature 15 observation ("6 to 9 s each when together, 0.9 s alone") is the same effect.
3. **Most of each call's server time is PHP, not the database.** Alone, `db` is 120 to 150 ms of a 730 to 880 ms `app` (about 17%), so about 600 to 730 ms per call is PHP work. With OPcache off, every request compiles Laravel's PHP files from scratch, which is heavy CPU work on a 0.15 CPU slice. That makes AC-5 (a) the strongest candidate.
4. **The rate limiter adds most of the queries.** 6 to 10 of the 7 to 11 queries per call are limiter reads and writes on the `database` store, each a round trip to Neon. That supports trying AC-5 (b).
5. **What this predicts for the client fix.** AC-6 (prefetch, so waterfall becomes parallel) should move the run finish very little while the CPU is the limit, because parallel is already no faster than waterfall here. It is still measured under AC-4 as the spec says, but expect "no measurable effect" unless the runtime fixes first make the CPU stop being the limit.
6. **Network share is small and fixed.** Connect to the Cloudflare edge is 12 to 60 ms. The remaining ttfb minus `app` (about 100 to 250 ms) is Cloudflare to Frankfurt, NGINX, and FPM handoff. Nothing in the app can change it.
7. **AC-5 (c) is skipped by its own rule.** FPM already allows 20 workers, more than the 5 parallel calls, and the evidence shows no worker queueing.

### Cold runs (after more than 15 min idle)

Three `--waterfall` runs, each after at least 16 min 40 s with no traffic from this machine. No restart and no Render change; the instance spun down on its own. All 15 calls answered 200.

| run | started (UTC) | `/home` ttfb | `/home` app | wake time (ttfb − app) | wave 2 slowest total | run finish |
|---|---|---:|---:|---:|---:|---:|
| cold 1 | 08:42:08 | 25256.6 | 844.8 | 24411.8 | 5308.1 | 30566.8 |
| cold 2 | 08:59:19 | 24176.8 | 831.5 | 23345.3 | 5139.7 | 29318.6 |
| cold 3 | 09:16:28 | 35393.2 | 904.6 | 34488.6 | 6148.8 | 41542.6 |
| **median** | | | | **24411.8** | | **30566.8** |

8. **A cold start costs about 23 to 35 s, all before PHP runs.** The first call's `app` stays under 1 s, the same as warm, so the wait is Render starting the container (spin up, migrations on start, FPM boot), not application work. The four block calls after it look exactly like a warm wave 2 (4.3 to 6.1 s). AC-8 keeps cold starts as they are (no keep alive ping, spec 0001); this is the number for the Infrastructure limits note.

## Steps

| # | Step | Mode | Median run finish | Max run finish | Change vs step before | Kept? |
|---|---|---|---:|---:|---:|---|
| 0 | Baseline (`eabd7aa`) | waterfall | 5722.5 | 6631.0 | | |
| 0 | Baseline (`eabd7aa`) | parallel | 5679.5 | 6693.7 | | |
| 0 | Baseline (`eabd7aa`) | serial | 5577.3 | 6385.7 | | |
| 1 | AC-5 (a) OPcache on (`PHP_OPCACHE_ENABLE=1`) | waterfall | 973.4 | 1566.4 | −83.0% (max −76.4%) | Keep |

### Step 1: AC-5 (a) OPcache

**Taken**: 2026-11-16, 09:32 UTC · **Code**: `1932372` (no code change since the baseline; `eabd7aa` plus docs) · **Change**: Render env `PHP_OPCACHE_ENABLE=1` only. The startup log shows `OPcache: ✅ Enabled`. Warmed the same way as the baseline: one `/home` call, then 5 s. All 50 calls answered 200; no 429.

Before the experiment, a throwaway local container of `serversideup/php:8.4-fpm-nginx` showed that the variable switches OPcache on for FPM. Its `serversideup-docker-php.ini` has `opcache.enable=${PHP_OPCACHE_ENABLE}`, and a live FPM request reported `enabled=true` with hits counting up. Unset, it reported `enabled=false`. The other settings stay at the image defaults: 256 MB memory, `validate_timestamps=0` (safe here, because every deploy starts a fresh container), JIT off.

**`--waterfall`, 10 warm runs**, against step 0 waterfall

| call | median total | change | max total | median app | change | median db | change | db share of app |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/home` | 238.0 (842.8) | −71.8% | 382.0 | 107.5 (631.7) | −83.0% | 92.8 (156.5) | −40.7% | 86% |
| `/home/banners` | 694.8 (4578.7) | −84.8% | 1007.1 | 548.8 (4430.5) | −87.6% | 437.1 (830.0) | −47.3% | 80% |
| `/home/best-sellers` | 674.7 (4245.8) | −84.1% | 1118.6 | 423.9 (3974.6) | −89.3% | 349.5 (828.2) | −57.8% | 82% |
| `/home/deals` | 703.2 (4390.8) | −84.0% | 1118.6 | 533.2 (4149.1) | −87.1% | 385.6 (598.6) | −35.6% | 72% |
| `/products` | 720.9 (4768.2) | −84.9% | 1184.4 | 561.2 (4619.9) | −87.9% | 398.9 (787.2) | −49.3% | 71% |
| **run finish** | **973.4** (5722.5) | **−83.0%** | **1566.4** (6631.0) | | | | | |

Baseline values are in brackets.

**AC-4 decision: Keep.** The median run finish fell 83.0% (5722.5 → 973.4 ms), far past the 10% bar (≤ 5150 ms). The maximum fell 76.4%. Run 1 (1566.4 ms) is the slowest because the warm up compiled only `/home`'s files; the four block endpoints' files were compiled into OPcache during that run. Runs 2 to 10 sit between 914.7 and 1113.3 ms.

**What changed in the picture**

1. **PHP compile time was the main cost.** Server time alone (`app` on `/home`) fell from 631.7 to 107.5 ms. Per call, roughly 520 ms of every request was PHP compiling Laravel's files again, on a 0.15 CPU slice.
2. **The database is now the larger part of server time.** `db` is 71 to 86% of `app` on every call (it was about 17% before). `db` also dropped (by 36 to 58%), because a query's measured time includes PDO and PHP work on the same starved CPU.
3. **The concurrency penalty is much smaller.** In wave 2, each call's `app` is 420 to 560 ms against about 110 ms for `/home` alone, so running four together still costs about 4 times per call, but on a much smaller base.
4. **Next candidate.** `/home` still runs 7 to 11 queries where its action needs 1, and those queries now dominate. That makes AC-5 (b) (limiter off the `database` store) the logical next step, measured against this step's 973.4 ms (keep bar: ≤ 876.1 ms).
5. **Watch item.** OPcache reserves up to 256 MB of shared memory on a 512 MB instance; only the pages in use count. Check the Render memory graph. A lower `PHP_OPCACHE_MEMORY_CONSUMPTION` would be its own measured step.

## Raw evidence

The full output of each `scripts/measure-home.sh` call, unedited.

<details><summary><code>warm-waterfall</code></summary>

```text
Mode: waterfall · runs: 10 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    14.9  ttfb   792.3  total   792.7  app   631.1  db    91.6
  /home/best-sellers    200  connect     0.0  ttfb  4046.7  total  4088.2  app  3898.4  db   934.6
  /home/deals           200  connect     0.0  ttfb  4064.8  total  4108.5  app  3811.4  db   543.0
  /home/banners         200  connect    15.4  ttfb  4903.5  total  4905.6  app  4406.7  db   840.1
  /products             200  connect     0.0  ttfb  4972.1  total  5018.1  app  4885.8  db  1002.8
  finish               5810.9 ms
Run 2
  /home                 200  connect    25.0  ttfb  1420.3  total  1420.7  app  1232.4  db   264.5
  /home/best-sellers    200  connect     0.0  ttfb  4392.6  total  4491.8  app  4037.9  db   626.5
  /home/banners         200  connect    66.8  ttfb  4491.7  total  4493.6  app  4004.3  db   818.5
  /home/deals           200  connect     0.0  ttfb  4396.5  total  4493.7  app  4136.9  db   530.5
  /products             200  connect     0.0  ttfb  5109.2  total  5210.4  app  5003.6  db   545.6
  finish               6631.0 ms
Run 3
  /home                 200  connect    17.6  ttfb  1017.5  total  1017.9  app   824.4  db   162.9
  /home/best-sellers    200  connect     0.0  ttfb  4171.4  total  4217.8  app  4102.2  db  1313.5
  /home/banners         200  connect    14.5  ttfb  4692.9  total  4695.0  app  4502.8  db  1412.3
  /home/deals           200  connect     0.0  ttfb  4668.2  total  4712.1  app  4590.9  db   528.7
  /products             200  connect     0.0  ttfb  4831.6  total  4873.5  app  4692.8  db   739.6
  finish               5891.4 ms
Run 4
  /home                 200  connect    58.8  ttfb   838.5  total   838.9  app   622.5  db   150.1
  /home/best-sellers    200  connect     0.0  ttfb  3950.1  total  3978.1  app  3708.2  db   746.5
  /home/deals           200  connect     0.0  ttfb  3948.0  total  3978.1  app  3630.6  db   528.1
  /home/banners         200  connect    11.9  ttfb  4229.6  total  4232.0  app  4116.3  db   908.2
  /products             200  connect     0.0  ttfb  4400.5  total  4428.8  app  4314.0  db   268.5
  finish               5267.7 ms
Run 5
  /home                 200  connect    57.5  ttfb   877.0  total   877.4  app   625.0  db   181.4
  /home/banners         200  connect    17.4  ttfb  3663.9  total  3666.1  app  3539.8  db   532.3
  /home/deals           200  connect     0.0  ttfb  4515.3  total  4557.4  app  4439.1  db   657.9
  /products             200  connect     0.0  ttfb  4615.6  total  4662.8  app  4546.9  db   911.9
  /home/best-sellers    200  connect     0.0  ttfb  4716.6  total  4756.8  app  4647.3  db  1016.1
  finish               5634.2 ms
Run 6
  /home                 200  connect    12.6  ttfb   738.2  total   741.9  app   642.0  db   181.5
  /home/best-sellers    200  connect     0.0  ttfb  3742.9  total  3783.3  app  3441.0  db   741.6
  /home/banners         200  connect    11.8  ttfb  5007.4  total  5009.5  app  4701.4  db   787.6
  /home/deals           200  connect     0.0  ttfb  4971.3  total  5009.8  app  4701.0  db   755.5
  /products             200  connect     0.0  ttfb  5248.7  total  5291.5  app  5144.5  db   749.2
  finish               6033.4 ms
Run 7
  /home                 200  connect    14.5  ttfb   846.3  total   846.6  app   632.3  db   137.5
  /home/deals           200  connect     0.0  ttfb  3511.6  total  3563.1  app  3355.1  db   833.0
  /home/banners         200  connect    17.3  ttfb  3844.7  total  3846.9  app  3666.9  db   820.0
  /home/best-sellers    200  connect     0.0  ttfb  4222.2  total  4273.8  app  3911.2  db   628.6
  /products             200  connect     0.0  ttfb  4226.7  total  4351.9  app  4106.5  db   534.0
  finish               5198.5 ms
Run 8
  /home                 200  connect    56.7  ttfb   776.9  total   779.3  app   623.3  db   180.0
  /home/best-sellers    200  connect     0.0  ttfb  3806.0  total  3845.1  app  3570.7  db   547.9
  /home/deals           200  connect     0.0  ttfb  3803.9  total  3845.1  app  3570.5  db   567.7
  /products             200  connect     0.0  ttfb  4429.8  total  4470.9  app  4176.9  db   825.2
  /home/banners         200  connect    14.4  ttfb  4586.3  total  4588.5  app  4475.5  db   661.2
  finish               5367.7 ms
Run 9
  /home                 200  connect    15.1  ttfb   661.1  total   661.5  app   545.8  db    91.4
  /home/deals           200  connect     0.0  ttfb  4245.0  total  4287.9  app  4161.3  db   629.5
  /products             200  connect     0.0  ttfb  4345.4  total  4391.9  app  4254.3  db   831.4
  /home/banners         200  connect    15.0  ttfb  4563.8  total  4569.0  app  4454.4  db  1038.9
  /home/best-sellers    200  connect     0.0  ttfb  4723.9  total  4766.1  app  4648.0  db   927.2
  finish               5427.6 ms
Run 10
  /home                 200  connect    36.1  ttfb   850.7  total   851.2  app   711.6  db   135.5
  /home/banners         200  connect    19.6  ttfb  5017.1  total  5017.5  app  4873.1  db  1515.4
  /home/best-sellers    200  connect     0.0  ttfb  4974.5  total  5017.4  app  4746.4  db   910.0
  /home/deals           200  connect     0.0  ttfb  5487.9  total  5530.4  app  5272.9  db   991.3
  /products             200  connect     0.0  ttfb  5702.5  total  5745.3  app  5567.7  db  1227.8
  finish               6596.4 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                       842.4        842.8       1420.7        631.7        156.5
/home/banners              4575.0       4578.7       5017.5       4430.5        830.0
/home/best-sellers         4196.8       4245.8       5017.4       3974.6        828.2
/home/deals                4320.7       4390.8       5530.4       4149.1        598.6
/products                  4723.6       4768.2       5745.3       4619.9        787.2
run finish                              5722.5       6631.0
```

</details>

<details><summary><code>warm-parallel</code></summary>

```text
Mode: parallel · runs: 10 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    19.2  ttfb  5005.9  total  5006.3  app  4791.8  db  1228.4
  /home/best-sellers    200  connect     0.0  ttfb  5478.7  total  5516.3  app  5107.2  db  1814.4
  /home/banners         200  connect     0.0  ttfb  5661.4  total  5699.1  app  5588.8  db  1160.5
  /products             200  connect     0.0  ttfb  5668.9  total  5706.5  app  5591.7  db  1022.5
  /home/deals           200  connect     0.0  ttfb  5927.4  total  5965.1  app  5711.2  db   948.1
  finish               5965.1 ms
Run 2
  /home                 200  connect    56.0  ttfb  3993.2  total  3995.0  app  3851.8  db   526.1
  /home/best-sellers    200  connect     0.0  ttfb  4166.4  total  4246.4  app  4008.8  db   905.7
  /home/banners         200  connect     0.0  ttfb  4593.4  total  4674.3  app  4447.7  db  1201.2
  /home/deals           200  connect     0.0  ttfb  4817.0  total  4902.2  app  4737.5  db   627.9
  /products             200  connect     0.0  ttfb  5219.1  total  5304.5  app  4812.5  db   762.9
  finish               5304.5 ms
Run 3
  /home                 200  connect    48.8  ttfb  5132.3  total  5132.7  app  4886.7  db  1697.5
  /home/deals           200  connect     0.0  ttfb  5542.8  total  5618.7  app  5193.3  db  1438.6
  /home/best-sellers    200  connect     0.0  ttfb  5982.6  total  6058.6  app  5802.5  db  1120.0
  /products             200  connect     0.0  ttfb  6265.5  total  6340.7  app  6185.8  db   970.9
  /home/banners         200  connect     0.0  ttfb  6368.1  total  6447.5  app  6295.5  db  1220.5
  finish               6447.5 ms
Run 4
  /home                 200  connect    21.1  ttfb  4442.9  total  4444.8  app  4345.8  db   811.9
  /home/banners         200  connect     0.0  ttfb  5380.5  total  5418.1  app  5146.6  db   724.3
  /home/best-sellers    200  connect     0.0  ttfb  5409.6  total  5451.3  app  5319.4  db   845.7
  /home/deals           200  connect     0.0  ttfb  5418.0  total  5453.9  app  5342.2  db  1329.7
  /products             200  connect     0.0  ttfb  5685.7  total  5725.3  app  5544.2  db  1130.5
  finish               5725.3 ms
Run 5
  /home                 200  connect    29.3  ttfb  5265.3  total  5268.2  app  5150.2  db  1142.0
  /home/banners         200  connect     0.0  ttfb  5416.2  total  5474.9  app  5351.1  db  1519.9
  /products             200  connect     0.0  ttfb  5736.7  total  5791.1  app  5553.5  db  1139.1
  /home/best-sellers    200  connect     0.0  ttfb  5807.6  total  5864.3  app  5697.8  db   616.6
  /home/deals           200  connect     0.0  ttfb  6014.7  total  6069.0  app  5941.8  db  1304.6
  finish               6069.0 ms
Run 6
  /home/deals           200  connect     0.0  ttfb  4546.9  total  4576.3  app  4411.7  db  1034.8
  /products             200  connect     0.0  ttfb  4544.9  total  4576.3  app  4343.7  db   920.3
  /home                 200  connect    12.5  ttfb  5009.2  total  5009.5  app  4758.7  db   538.6
  /home/best-sellers    200  connect     0.0  ttfb  5261.4  total  5292.6  app  5158.6  db   762.2
  /home/banners         200  connect     0.0  ttfb  5424.4  total  5455.6  app  5360.2  db  1622.8
  finish               5455.6 ms
Run 7
  /home/deals           200  connect     0.0  ttfb  5623.3  total  5669.2  app  5428.6  db   453.3
  /home/banners         200  connect     0.0  ttfb  5694.6  total  5745.2  app  5620.9  db  1621.7
  /home                 200  connect    18.6  ttfb  5932.5  total  5934.8  app  5710.7  db   643.1
  /home/best-sellers    200  connect     0.0  ttfb  5894.4  total  5942.8  app  5805.1  db  1306.0
  /products             200  connect     0.0  ttfb  6647.0  total  6693.7  app  6406.5  db   843.3
  finish               6693.7 ms
Run 8
  /home                 200  connect    18.0  ttfb  4196.1  total  4196.5  app  3887.3  db   711.7
  /home/banners         200  connect     0.0  ttfb  5076.4  total  5120.3  app  4972.4  db  1998.0
  /home/deals           200  connect     0.0  ttfb  5205.3  total  5249.2  app  5098.2  db   970.8
  /products             200  connect     0.0  ttfb  5495.8  total  5539.9  app  5396.8  db   636.6
  /home/best-sellers    200  connect     0.0  ttfb  5561.8  total  5604.3  app  5491.7  db   831.4
  finish               5604.3 ms
Run 9
  /home/best-sellers    200  connect     0.0  ttfb  4506.6  total  4546.7  app  4340.1  db   725.7
  /home/deals           200  connect     0.0  ttfb  4719.1  total  4758.1  app  4640.1  db   826.5
  /home                 200  connect    12.2  ttfb  5143.9  total  5144.3  app  4939.0  db  1216.3
  /products             200  connect     0.0  ttfb  5323.9  total  5366.9  app  5244.3  db  1149.0
  /home/banners         200  connect     0.0  ttfb  5522.7  total  5564.2  app  5448.7  db  1043.7
  finish               5564.2 ms
Run 10
  /home/deals           200  connect     0.0  ttfb  4909.5  total  4949.0  app  4801.9  db  1328.0
  /home                 200  connect    13.9  ttfb  5026.6  total  5026.9  app  4923.5  db  1297.3
  /home/banners         200  connect     0.0  ttfb  5578.7  total  5618.3  app  5114.0  db  1225.9
  /home/best-sellers    200  connect     0.0  ttfb  5580.9  total  5618.6  app  5231.9  db  1304.0
  /products             200  connect     0.0  ttfb  5590.9  total  5633.7  app  5522.5  db   734.2
  finish               5633.7 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                      5017.9       5018.2       5934.8       4839.2        977.0
/home/banners              5473.5       5519.6       6447.5       5355.6       1223.2
/home/best-sellers         5520.2       5560.3       6058.6       5275.6        875.7
/home/deals                5311.6       5351.5       6069.0       5145.8       1002.8
/products                  5629.9       5670.1       6693.7       5533.4        945.6
run finish                              5679.5       6693.7
```

</details>

<details><summary><code>warm-serial</code></summary>

```text
Mode: serial · runs: 10 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    18.7  ttfb   817.6  total   817.8  app   684.9  db   178.6
  /home/banners         200  connect    12.7  ttfb   942.7  total   944.9  app   681.7  db   147.4
  /home/best-sellers    200  connect    76.3  ttfb  1530.3  total  1532.4  app  1342.5  db   252.4
  /home/deals           200  connect    13.5  ttfb   888.5  total   890.7  app   693.0  db    50.9
  /products             200  connect    12.3  ttfb  1099.2  total  1102.2  app   685.7  db    63.3
  finish               5288.0 ms
Run 2
  /home                 200  connect    14.9  ttfb  1272.1  total  1272.5  app  1103.7  db   121.8
  /home/banners         200  connect    13.5  ttfb  1030.6  total  1031.1  app   821.5  db   144.0
  /home/best-sellers    200  connect    13.7  ttfb   937.4  total   939.5  app   773.4  db    49.6
  /home/deals           200  connect    81.3  ttfb  1004.7  total  1006.8  app   669.7  db    66.9
  /products             200  connect    12.5  ttfb  1671.6  total  1673.8  app  1434.3  db   325.0
  finish               5923.7 ms
Run 3
  /home                 200  connect    56.3  ttfb   867.8  total   868.1  app   647.6  db   182.2
  /home/banners         200  connect    41.9  ttfb  2237.6  total  2239.7  app  2067.0  db   425.1
  /home/best-sellers    200  connect    55.7  ttfb   934.2  total   936.3  app   782.1  db   120.6
  /home/deals           200  connect    13.2  ttfb   970.5  total   972.5  app   789.5  db   137.4
  /products             200  connect    14.8  ttfb  1003.9  total  1007.1  app   887.5  db    53.3
  finish               6023.6 ms
Run 4
  /home                 200  connect    19.3  ttfb   951.9  total   952.1  app   815.0  db    50.1
  /home/banners         200  connect    17.0  ttfb   773.6  total   775.3  app   630.1  db    64.0
  /home/best-sellers    200  connect    17.3  ttfb   999.7  total  1001.9  app   716.1  db   137.9
  /home/deals           200  connect    14.0  ttfb  1052.3  total  1057.0  app   951.2  db   321.1
  /products             200  connect    14.5  ttfb  1468.7  total  1471.0  app  1182.7  db   137.2
  finish               5257.3 ms
Run 5
  /home                 200  connect    18.8  ttfb  1023.0  total  1023.4  app   772.5  db   137.8
  /home/banners         200  connect    13.1  ttfb  1721.5  total  1723.6  app  1527.0  db   230.7
  /home/best-sellers    200  connect    12.5  ttfb  1153.4  total  1154.0  app   896.5  db   136.1
  /home/deals           200  connect    12.1  ttfb  1030.8  total  1031.4  app   820.5  db   116.6
  /products             200  connect    16.3  ttfb   932.1  total   934.3  app   769.9  db   148.1
  finish               5866.6 ms
Run 6
  /home                 200  connect    15.9  ttfb   924.0  total   924.2  app   792.1  db   197.7
  /home/banners         200  connect    13.4  ttfb  1009.1  total  1011.2  app   862.0  db   139.2
  /home/best-sellers    200  connect    14.3  ttfb  1106.6  total  1108.6  app   903.2  db   188.5
  /home/deals           200  connect    19.5  ttfb  1696.6  total  1698.8  app  1410.0  db   147.6
  /products             200  connect    60.9  ttfb  1337.9  total  1340.2  app  1011.8  db   153.2
  finish               6083.1 ms
Run 7
  /home                 200  connect    23.5  ttfb  1634.3  total  1634.7  app  1404.4  db   107.5
  /home/banners         200  connect    14.9  ttfb  1008.6  total  1010.8  app   824.9  db   148.2
  /home/best-sellers    200  connect    11.7  ttfb  1110.0  total  1112.1  app   823.1  db   186.5
  /home/deals           200  connect    11.6  ttfb   984.4  total   991.1  app   874.6  db   121.6
  /products             200  connect    13.5  ttfb  1632.9  total  1637.0  app  1474.0  db   299.7
  finish               6385.7 ms
Run 8
  /home                 200  connect    12.8  ttfb   814.5  total   814.8  app   600.6  db    40.4
  /home/banners         200  connect    17.6  ttfb  1243.0  total  1247.8  app  1135.7  db   388.8
  /home/best-sellers    200  connect    13.8  ttfb  1068.7  total  1070.7  app   886.7  db   187.3
  /home/deals           200  connect    19.6  ttfb  1004.5  total  1006.7  app   666.6  db    51.9
  /products             200  connect    15.2  ttfb  1003.1  total  1007.4  app   878.7  db   177.5
  finish               5147.3 ms
Run 9
  /home                 200  connect    23.7  ttfb   919.4  total   919.8  app   606.3  db    40.8
  /home/banners         200  connect    11.4  ttfb   930.7  total   932.8  app   684.2  db   117.1
  /home/best-sellers    200  connect    12.2  ttfb   771.9  total   774.2  app   635.6  db   130.1
  /home/deals           200  connect    11.6  ttfb   762.3  total   762.9  app   647.2  db   124.0
  /products             200  connect    19.0  ttfb   838.3  total   840.7  app   637.9  db   208.6
  finish               4230.4 ms
Run 10
  /home                 200  connect    20.4  ttfb   766.5  total   766.8  app   656.1  db   123.6
  /home/banners         200  connect    14.0  ttfb   782.6  total   789.1  app   683.1  db   181.2
  /home/best-sellers    200  connect    11.8  ttfb   770.5  total   773.1  app   678.7  db   136.9
  /home/deals           200  connect    12.0  ttfb  1404.7  total  1406.8  app  1178.8  db   234.3
  /products             200  connect    12.5  ttfb  1158.3  total  1162.5  app   878.2  db   138.3
  finish               4898.4 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                       921.7        922.0       1634.7        728.7        122.7
/home/banners              1008.8       1011.0       2239.7        823.2        147.8
/home/best-sellers         1034.2       1036.3       1532.4        802.6        137.4
/home/deals                1004.6       1006.7       1698.8        805.0        122.8
/products                  1128.7       1132.4       1673.8        883.1        150.6
run finish                              5577.3       6385.7
```

</details>

<details><summary><code>query-counts</code></summary>

```text
/home                200 app;dur=857.7, db;dur=118.7;desc="7 queries"
/home/banners        200 app;dur=881.8, db;dur=139.8;desc="10 queries"
/home/best-sellers   200 app;dur=802.6, db;dur=138.1;desc="9 queries"
/home/deals          200 app;dur=756.1, db;dur=137.5;desc="9 queries"
/products            200 app;dur=1410.0, db;dur=136.9;desc="10 queries"
```

</details>

<details><summary><code>cold</code></summary>

```text
=== cold 1 started 2026-11-16T08:42:08Z
Mode: waterfall · runs: 1 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    60.8  ttfb 25256.6  total 25258.7  app   844.8  db   219.5
  /products             200  connect     0.0  ttfb  4359.7  total  4401.6  app  4280.9  db   934.7
  /home/deals           200  connect     0.0  ttfb  4462.0  total  4501.0  app  4108.0  db   845.4
  /home/banners         200  connect    12.8  ttfb  5302.0  total  5304.2  app  4996.8  db   664.2
  /home/best-sellers    200  connect     0.0  ttfb  5272.2  total  5308.1  app  5110.9  db   631.1
  finish               30566.8 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                     25256.6      25258.7      25258.7        844.8        219.5
/home/banners              5302.0       5304.2       5304.2       4996.8        664.2
/home/best-sellers         5272.2       5308.1       5308.1       5110.9        631.1
/home/deals                4462.0       4501.0       4501.0       4108.0        845.4
/products                  4359.7       4401.6       4401.6       4280.9        934.7
run finish                             30566.8      30566.8
exit=0
=== cold 2 started 2026-11-16T08:59:19Z
Mode: waterfall · runs: 1 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    52.5  ttfb 24176.8  total 24178.9  app   831.5  db   174.5
  /home/banners         200  connect    14.5  ttfb  4328.7  total  4330.8  app  4002.2  db   915.6
  /home/best-sellers    200  connect     0.0  ttfb  4382.1  total  4437.8  app  4006.7  db   729.6
  /home/deals           200  connect     0.0  ttfb  4889.3  total  4943.4  app  4606.5  db   722.9
  /products             200  connect     0.0  ttfb  5085.5  total  5139.7  app  4995.2  db   706.7
  finish               29318.6 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                     24176.8      24178.9      24178.9        831.5        174.5
/home/banners              4328.7       4330.8       4330.8       4002.2        915.6
/home/best-sellers         4382.1       4437.8       4437.8       4006.7        729.6
/home/deals                4889.3       4943.4       4943.4       4606.5        722.9
/products                  5085.5       5139.7       5139.7       4995.2        706.7
run finish                             29318.6      29318.6
exit=0
=== cold 3 started 2026-11-16T09:16:28Z
Mode: waterfall · runs: 1 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    65.5  ttfb 35393.2  total 35393.7  app   904.6  db   219.6
  /home/best-sellers    200  connect     0.0  ttfb  4331.6  total  4385.1  app  4227.3  db  1196.3
  /home/banners         200  connect    26.8  ttfb  5697.2  total  5699.4  app  5526.2  db  1543.0
  /products             200  connect     0.0  ttfb  5967.5  total  6021.2  app  5832.9  db   934.7
  /home/deals           200  connect     0.0  ttfb  6095.3  total  6148.8  app  5816.8  db   914.8
  finish               41542.6 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                     35393.2      35393.7      35393.7        904.6        219.6
/home/banners              5697.2       5699.4       5699.4       5526.2       1543.0
/home/best-sellers         4331.6       4385.1       4385.1       4227.3       1196.3
/home/deals                6095.3       6148.8       6148.8       5816.8        914.8
/products                  5967.5       6021.2       6021.2       5832.9        934.7
run finish                             41542.6      41542.6
exit=0
```

</details>

<details><summary><code>step-1-opcache-waterfall</code> (2026-11-16 09:32 UTC)</summary>

```text
Mode: waterfall · runs: 10 · API: https://eneba-api.onrender.com/api/v1
Run 1
  /home                 200  connect    16.2  ttfb   381.6  total   382.0  app   116.5  db    95.7
  /home/banners         200  connect    77.1  ttfb  1005.0  total  1007.1  app   787.9  db   640.7
  /home/best-sellers    200  connect     0.0  ttfb  1023.8  total  1118.6  app   891.2  db   468.2
  /home/deals           200  connect     0.0  ttfb  1023.3  total  1118.6  app   780.7  db   636.4
  /products             200  connect     0.0  ttfb  1083.2  total  1184.4  app   925.3  db   356.5
  finish               1566.4 ms
Run 2
  /home                 200  connect    11.6  ttfb   226.8  total   227.2  app   110.8  db    96.4
  /home/best-sellers    200  connect     0.0  ttfb   546.2  total   596.7  app   370.2  db   295.1
  /home/banners         200  connect    13.4  ttfb   683.8  total   689.1  app   553.8  db   412.2
  /home/deals           200  connect     0.0  ttfb   650.1  total   705.7  app   558.4  db   385.1
  /products             200  connect     0.0  ttfb   660.5  total   713.6  app   522.9  db   246.7
  finish               940.8 ms
Run 3
  /home                 200  connect    15.2  ttfb   237.5  total   239.8  app   120.7  db   107.2
  /home/best-sellers    200  connect     0.0  ttfb   611.3  total   648.2  app   473.4  db   457.3
  /products             200  connect     0.0  ttfb   613.5  total   648.2  app   472.9  db   374.9
  /home/banners         200  connect    12.3  ttfb   679.8  total   684.5  app   578.3  db   428.5
  /home/deals           200  connect     0.0  ttfb   726.3  total   763.9  app   551.6  db   312.8
  finish               1003.6 ms
Run 4
  /home                 200  connect    15.3  ttfb   232.6  total   236.3  app   115.5  db   100.3
  /home/banners         200  connect    14.8  ttfb   695.0  total   700.5  app   598.6  db   454.2
  /home/deals           200  connect     0.0  ttfb   666.0  total   700.7  app   587.5  db   490.6
  /products             200  connect     0.0  ttfb   666.9  total   706.5  app   594.9  db   570.9
  /home/best-sellers    200  connect     0.0  ttfb   691.1  total   727.9  app   616.8  db   455.3
  finish               964.2 ms
Run 5
  /home                 200  connect    86.1  ttfb   320.5  total   320.8  app   101.7  db    87.2
  /home/banners         200  connect    16.7  ttfb   576.5  total   582.1  app   463.9  db   378.7
  /home/deals           200  connect     0.0  ttfb   564.9  total   613.4  app   466.3  db   413.6
  /home/best-sellers    200  connect     0.0  ttfb   654.8  total   699.8  app   551.7  db   359.7
  /products             200  connect     0.0  ttfb   743.6  total   792.5  app   605.7  db   582.2
  finish               1113.3 ms
Run 6
  /home                 200  connect    13.3  ttfb   208.0  total   210.8  app   101.1  db    89.2
  /home/best-sellers    200  connect     0.0  ttfb   510.5  total   596.7  app   366.0  db   348.4
  /home/banners         200  connect    64.4  ttfb   612.6  total   617.1  app   464.8  db   301.6
  /home/deals           200  connect     0.0  ttfb   533.0  total   618.3  app   464.1  db   380.1
  /products             200  connect     0.0  ttfb   630.7  total   722.4  app   527.6  db   313.6
  finish               933.2 ms
Run 7
  /home                 200  connect    25.9  ttfb   194.9  total   195.2  app    84.7  db    72.9
  /home/banners         200  connect    12.1  ttfb   718.7  total   718.9  app   438.9  db   351.9
  /home/best-sellers    200  connect     0.0  ttfb   689.2  total   719.5  app   425.9  db   350.6
  /home/deals           200  connect     0.0  ttfb   686.3  total   719.5  app   411.9  db   394.4
  /products             200  connect     0.0  ttfb   688.8  total   719.5  app   525.2  db   503.9
  finish               914.7 ms
Run 8
  /home                 200  connect    79.2  ttfb   304.3  total   306.3  app   117.9  db   104.9
  /home/best-sellers    200  connect     0.0  ttfb   660.3  total   694.1  app   421.9  db   336.3
  /home/deals           200  connect     0.0  ttfb   658.2  total   694.1  app   435.3  db   333.2
  /home/banners         200  connect    13.8  ttfb   793.1  total   793.4  app   634.9  db   539.3
  /products             200  connect     0.0  ttfb   759.8  total   795.2  app   632.8  db   531.7
  finish               1101.5 ms
Run 9
  /home                 200  connect    58.8  ttfb   248.1  total   250.7  app    86.8  db    73.8
  /home/banners         200  connect    15.8  ttfb   655.2  total   655.5  app   543.8  db   445.6
  /home/best-sellers    200  connect     0.0  ttfb   617.4  total   655.4  app   335.4  db   317.2
  /home/deals           200  connect     0.0  ttfb   619.5  total   655.4  app   535.5  db   386.2
  /products             200  connect     0.0  ttfb   690.0  total   731.9  app   616.3  db   422.8
  finish               982.6 ms
Run 10
  /home                 200  connect    17.4  ttfb   212.4  total   212.7  app   104.3  db    89.8
  /home/best-sellers    200  connect     0.0  ttfb   609.8  total   653.0  app   412.2  db   149.4
  /products             200  connect     0.0  ttfb   612.0  total   653.0  app   427.9  db   340.4
  /home/banners         200  connect    18.5  ttfb   718.4  total   721.5  app   540.4  db   446.5
  /home/deals           200  connect     0.0  ttfb   686.1  total   729.1  app   531.0  db   354.4
  finish               941.8 ms

call (ms)             median ttfb median total    max total   median app    median db
/home                       235.1        238.0        382.0        107.5         92.8
/home/banners               689.4        694.8       1007.1        548.8        437.1
/home/best-sellers          636.1        674.7       1118.6        423.9        349.5
/home/deals                 662.1        703.2       1118.6        533.2        385.6
/products                   677.9        720.9       1184.4        561.2        398.9
run finish                               973.4       1566.4
```

</details>
