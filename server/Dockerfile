# Production image for Render (spec 0001). NGINX + PHP-FPM, serves public/ on port 8080, runs as www-data.
# Container settings (AUTORUN_*, HEALTHCHECK_PATH) and app secrets come from Render env vars, never from here.
FROM serversideup/php:8.4-fpm-nginx

WORKDIR /var/www/html

# Dependencies first, so this layer stays cached until composer.lock changes.
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts --no-progress

COPY --chown=www-data:www-data . .

# Runs package:discover now that the app is present, without dev providers.
RUN composer dump-autoload --optimize --no-dev
