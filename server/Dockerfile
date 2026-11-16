# Production image for Render (spec 0001). NGINX + PHP-FPM, serves public/ on port 8080, runs as www-data.
# Container settings (AUTORUN_*, HEALTHCHECK_PATH) and app secrets come from Render env vars, never from here.
FROM serversideup/php:8.4-fpm-nginx

# nginx sets REMOTE_ADDR from Cloudflare's CF-Connecting-IP; bootstrap/app.php relies on this for rate limiting.
ENV TRUSTED_PROXY=cloudflare

WORKDIR /var/www/html

# APCu holds the rate limiter counters in FPM shared memory (spec 0016 AC-5 b). The image runs as www-data, so install as root.
USER root
RUN install-php-extensions apcu
USER www-data

# Dependencies first, so this layer stays cached until composer.lock changes.
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts --no-progress

COPY --chown=www-data:www-data . .

# Runs package:discover now that the app is present, without dev providers.
RUN composer dump-autoload --optimize --no-dev
