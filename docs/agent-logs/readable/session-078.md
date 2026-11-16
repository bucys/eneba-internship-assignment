# Session 078: HomeSeeder production safety review

- Session ID: `5d344e4d-828d-4efb-8bfa-a953bffa56ed`
- Source: `5d344e4d-828d-4efb-8bfa-a953bffa56ed.jsonl` (original JSONL, kept private and unmodified)
- Date: 2026-11-14 22:40 UTC → 2026-11-14 22:52 UTC
- Prompts: 1
- Full technical transcript: [full/session-078.md](../full/session-078.md)

> Readable view: every prompt the developer wrote and every visible reply from Claude, verbatim and in order.
> Tool calls, tool results, thinking, injected context and subagent transcripts appear only as short
> markers here and in full in the technical transcript. Sensitive values are shown as `[REDACTED:kind]`.

---

_The developer ran the local command `/clear` (handled by the client; Claude does not see or answer it)._

---

## USER · 1

<sub>2026-11-14 22:40 UTC · [open in full transcript](../full/session-078.md#prompt-1) · record `6c98fb72-51f3-41e7-b2a5-37db902f50ae`</sub>

Review the production safety of HomeSeeder before reseeding.

Inspect HomeSeeder, its dependencies, the homepage tables, and the production deployment configuration.

Determine:
- Exactly which tables and records the seeder creates, updates or deletes.
- Whether rerunning it is idempotent.
- Whether existing production users, carts, orders or offers could be affected.
- The safest way to run only HomeSeeder on Render with the current deployment setup.
- How to verify the result and recover if something fails.

Do not modify files, run migrations, seed databases, or execute production commands.

Report findings and the exact recommended command, if safe.

## CLAUDE · 1

*[5 tool calls: Bash ×5]*

I've finished the review and changed nothing. **It is safe to run HomeSeeder by itself, but only if you set two values on the command line.** If you skip `APP_URL`, production gets a localhost image link.

## What it writes
- **`home_blocks`:** upserts 4 rows matched on `type`. On a new row it sets `title`, `position` and `is_active=true`. On an existing row it updates only `title` and `position`.
- **`banners`:** upserts 8 rows matched on `product_id`. On an existing row it updates `title`, `tagline`, `cta_label`, `image_url` and `position`. `is_active` is set only on insert, so a banner you hid by hand stays hidden.
- **Reads only:** `products`, to look up the product id, cover image and active flag for each banner slug.
- **Never deletes anything.** If an old banner's product is no longer in `database/data/home.php`, that banner row stays.
- **Users, carts, orders, offers and keys are never touched.** The only side effect is the `restrictOnDelete` foreign key from `banners` to `products`: a product with a banner can't be deleted later.
- **This run's change:** Cyberpunk and Elden Ring swap places (positions 1 and 2), and Cyberpunk's `image_url` becomes `url('images/banners/cyberpunk-2077-featured.webp')`. There's no unique constraint on `position`, so the swap can't collide.

## Idempotency and failure
- Running it twice gives the same result: everything is an upsert on a unique key, inside one `DB::transaction`. `tests/Feature/Seed/HomeSeedersTest.php` covers the rerun.
- If a slug is unknown or a product is inactive, it throws and the transaction rolls back, so nothing is written.
- The image check runs against your **local** `public/`, not against Render's. It can pass even if Render hasn't deployed the image yet.

## Risks to rule out first
1. **`APP_URL`:** your local `.env` has `APP_URL=http://localhost:8000`. `url()` builds the link from this, so you must override it with the public API origin (https, no trailing slash).
2. **The image must already be live on Render.** It's committed in `5313932` and `main` is pushed, but check that the deploy has finished (step 1 below).
3. **Config cache:** there's no `bootstrap/cache/config.php` locally, so values set on the command line do take effect. If you ever run `config:cache` locally, they'll be ignored until you run `config:clear`.
4. **Render can't run this.** The free plan has no shell, and the Dockerfile and spec 0001 never seed on deploy (`AUTORUN_LARAVEL_MIGRATION_SEED=false`). It has to run from your machine against Neon.

## Recommended steps
```bash
# 1. Confirm the image is deployed (expect 200 and image/webp)
curl -sI https://<api-origin>/images/banners/cyberpunk-2077-featured.webp

# 2. Back up the two tables (optional, cheap)
pg_dump "<neon direct url>" -t home_blocks -t banners --data-only > /tmp/home-backup.sql

# 3. Run only HomeSeeder (leading space keeps secrets out of shell history)
cd server
 APP_ENV=production APP_URL=https://<api-origin> DB_URL='<neon direct url>' php artisan db:seed --class=HomeSeeder --force
```
Don't run plain `db:seed`. It also runs `CatalogSeeder` and `DemoOrdersSeeder`.

## Verify and recover
- **Verify:** `GET https://<api-origin>/api/v1/home/banners` should list Cyberpunk first, with `image_url` on your API origin (not localhost). The homepage hero should show the new image.
- **Bad `image_url`:** rerun the same command with the correct `APP_URL`. It overwrites in place.
- **Seeder threw:** nothing was written, because it rolled back. Fix the cause and rerun.
- **Full restore:** run `UPDATE` statements from the backup, or temporarily revert `database/data/home.php` locally and rerun the seeder. Either way, it only affects these two tables.
