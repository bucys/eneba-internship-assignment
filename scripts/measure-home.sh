#!/usr/bin/env bash
# Times the five calls the homepage makes (spec 0016 AC-2).
#
#   scripts/measure-home.sh <api-origin> [runs] [--parallel | --waterfall | --serial]
#
#   --parallel   all five at once (default; the client after the route loader prefetch)
#   --waterfall  /home first, then the other four at once (the client before it)
#   --serial     one after another (the cost of each call alone)
#
# <api-origin> is the API host, for example http://127.0.0.1:8000 (a trailing /api/v1 is fine).
# Runs default to 10, with 2 s between runs, so a session stays well under the catalog
# limit of 120 requests per minute per IP. Needs curl 7.84 or newer, bash, and awk only.

set -euo pipefail

usage() {
  echo "Usage: $0 <api-origin> [runs] [--parallel | --waterfall | --serial]" >&2
  exit 2
}

mode=""
positional=()
for arg in "$@"; do
  case "$arg" in
    --parallel | --waterfall | --serial)
      [ -z "$mode" ] || { echo "Pick one mode per call." >&2; exit 2; }
      mode="${arg#--}"
      ;;
    -h | --help) usage ;;
    -*) echo "Unknown option: $arg" >&2; usage ;;
    *) positional+=("$arg") ;;
  esac
done
mode="${mode:-parallel}"

[ "${#positional[@]}" -ge 1 ] && [ "${#positional[@]}" -le 2 ] || usage
origin="${positional[0]%/}"
origin="${origin%/api/v1}"
api="$origin/api/v1"
runs="${positional[1]:-10}"
case "$runs" in
  '' | *[!0-9]* | 0) echo "Runs must be a whole number above 0." >&2; exit 2 ;;
esac

# The grid's request is page 1 with the default params, which toStoreSearch writes as no query string
# (client/src/api/products.ts, client/src/lib/storeParams.ts).
paths=(/home /home/banners /home/best-sellers /home/deals /products)

format='%{url}\t%{http_code}\t%{time_connect}\t%{time_starttransfer}\t%{time_total}\t%header{server-timing}\n'

# Fetches the given paths together in one curl call and prints one tab separated line per call,
# prefixed with the run and wave number. The run finishes when its last wave's slowest call ends.
fetch_wave() {
  local run="$1" wave="$2" path
  shift 2
  local args=()
  for path in "$@"; do args+=(-o /dev/null "$api$path"); done

  curl --silent --show-error --parallel --max-time 120 \
    -H 'Accept: application/json' -w "$format" "${args[@]}" 2>/dev/null |
    while IFS= read -r line; do printf '%s\t%s\t%s\n' "$run" "$wave" "$line"; done || true
}

measure_run() {
  local run="$1" index
  case "$mode" in
    parallel) fetch_wave "$run" 1 "${paths[@]}" ;;
    waterfall)
      fetch_wave "$run" 1 "${paths[0]}"
      fetch_wave "$run" 2 "${paths[@]:1}"
      ;;
    serial)
      for index in "${!paths[@]}"; do fetch_wave "$run" "$((index + 1))" "${paths[$index]}"; done
      ;;
  esac
}

# Shared awk helpers: seconds to ms, Server-Timing parsing, and a sort (BSD awk has no asort).
awk_lib='
function ms(seconds) { return seconds * 1000 }
function timing(header, name) {
  if (match(header, name ";dur=[0-9.]+")) return substr(header, RSTART + length(name) + 5, RLENGTH - length(name) - 5)
  return "-"
}
function path_of(url) { return substr(url, length(api) + 1) }
function sort_values(values, n,   i, j, value) {
  for (i = 2; i <= n; i++) {
    value = values[i]
    for (j = i - 1; j > 0 && values[j] > value; j--) values[j + 1] = values[j]
    values[j + 1] = value
  }
}
function median(values, n) {
  sort_values(values, n)
  return n % 2 ? values[(n + 1) / 2] : (values[n / 2] + values[n / 2 + 1]) / 2
}
function maximum(values, n,   i, top) {
  top = values[1]
  for (i = 2; i <= n; i++) if (values[i] > top) top = values[i]
  return top
}
'

print_run() {
  awk -F'\t' -v api="$api" "$awk_lib"'
    { printf "  %-20s %4s  connect %7.1f  ttfb %7.1f  total %7.1f  app %7s  db %7s\n",
        path_of($3), $4, ms($5), ms($6), ms($7), timing($8, "app"), timing($8, "db")
      if ($7 > slowest[$2]) slowest[$2] = $7 }
    END { for (wave in slowest) finish += slowest[wave]; printf "  %-20s %.1f ms\n", "finish", ms(finish) }
  '
}

print_summary() {
  awk -F'\t' -v api="$api" -v order="${paths[*]}" "$awk_lib"'
    {
      path = path_of($3); n = ++count[path]
      ttfb[path, n] = ms($6); total[path, n] = ms($7)
      app[path, n] = timing($8, "app"); db[path, n] = timing($8, "db")
      if ($7 > slowest[$1, $2]) slowest[$1, $2] = $7
      runs[$1] = 1
    }
    function column(source, path, n, values,   i) { for (i = 1; i <= n; i++) values[i] = source[path, i] + 0 }
    END {
      printf "\n%-20s %12s %12s %12s %12s %12s\n", "call (ms)", "median ttfb", "median total", "max total", "median app", "median db"
      split(order, paths, " ")
      for (p = 1; p in paths; p++) {
        path = paths[p]; n = count[path]
        if (!n) continue
        column(ttfb, path, n, a); t = median(a, n)
        column(total, path, n, b); m = median(b, n); x = maximum(b, n)
        column(app, path, n, c); ap = median(c, n)
        column(db, path, n, d); dm = median(d, n)
        printf "%-20s %12.1f %12.1f %12.1f %12.1f %12.1f\n", path, t, m, x, ap, dm
        delete a; delete b; delete c; delete d
      }
      for (key in slowest) { split(key, parts, SUBSEP); finish[parts[1]] += slowest[key] }
      n = 0
      for (run in runs) values[++n] = ms(finish[run])
      printf "%-20s %12s %12.1f %12.1f\n", "run finish", "", median(values, n), maximum(values, n)
    }
  '
}

echo "Mode: $mode · runs: $runs · API: $api"
all_lines=""
for ((run = 1; run <= runs; run++)); do
  lines="$(measure_run "$run")"
  echo "Run $run"
  if [ -n "$lines" ]; then printf '%s\n' "$lines" | print_run; fi

  expected="${#paths[@]}"
  received="$(printf '%s\n' "$lines" | awk -F'\t' 'NF >= 4 { n++ } END { print n + 0 }')"
  if printf '%s\n' "$lines" | awk -F'\t' '$4 == 429 { found = 1 } END { exit !found }'; then
    echo "Rate limited: wait a minute, then run again." >&2
    exit 1
  fi
  if [ "$received" -ne "$expected" ] ||
    printf '%s\n' "$lines" | awk -F'\t' '$4 != 200 { bad = 1 } END { exit !bad }'; then
    echo "A call did not answer 200 (status 000 means no connection). Stopping." >&2
    exit 1
  fi

  all_lines+="$lines"$'\n'
  if [ "$run" -lt "$runs" ]; then sleep 2; fi
done

printf '%s' "$all_lines" | print_summary
