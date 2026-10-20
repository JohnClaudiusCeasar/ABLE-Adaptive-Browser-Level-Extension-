#!/bin/sh
set -e

# Render binds the web service to the port in $PORT (defaults to 80 if not set)
PORT="${PORT:-80}"
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Ensure storage directories exist
mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/storage/fonts \
         /var/www/html/storage/app/dompdf \
         /var/www/html/storage/app/public/chat-attachments \
         /var/www/html/storage/app/private \
         /var/www/html/bootstrap/cache \
         /var/www/html/database

# Handle SQLite database initialization
if [ "$DB_CONNECTION" = "sqlite" ] || [ -z "$DB_CONNECTION" ]; then
    if [ ! -f /var/www/html/database/database.sqlite ]; then
        echo "Creating new SQLite database file..."
        touch /var/www/html/database/database.sqlite
    fi
fi

# Ensure correct permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

# Create storage symlink if it doesn't exist
php artisan storage:link || true

# Ensure APP_KEY exists so Artisan operations never fail
if [ -z "$APP_KEY" ]; then
    echo "Warning: APP_KEY not provided by environment. Generating fallback key..."
    php artisan key:generate --force || true
fi

# Run database migrations with retry loop.
# A failed migration must never boot a container against a stale schema:
# the app would answer health checks while silently missing new columns.
echo "Waiting for database and running migrations..."
n=0
migrations_ok=0
until [ "$n" -ge 10 ]
do
    php artisan app:baseline-migrations || true
    if php artisan migrate --force --no-interaction; then
        migrations_ok=1
        break
    fi
    n=$((n+1))
    echo "Database not ready yet, retrying in 3 seconds ($n/10)..."
    sleep 3
done

if [ "$migrations_ok" -ne 1 ]; then
    echo "FATAL: database migrations failed after 10 attempts. Refusing to start."
    exit 1
fi

# Guarantee at least one Super Admin exists. The Team module is Super Admin
# only, so without this the roles could all settle on 'admin' and nobody
# would be able to promote anyone. Safe to re-run: it also repairs an
# account that was demoted or blocked.
echo "Ensuring bootstrap Super Admin..."
php artisan app:bootstrap-superadmin || true

# Seed reference/demo data. Every seeder self-skips when APP_ENV=production,
# so these calls are no-ops on Render and only populate local/dev containers.
# RiskPatternSeeder uses updateOrCreate(), so re-running each boot is safe.
echo "Checking seeders..."
php artisan db:seed --class=RiskPatternSeeder --force --no-interaction || true
php artisan db:seed --class=DomainBrandSeeder --force --no-interaction || true
php artisan db:seed --class=CommunityMessageSeeder --force --no-interaction || true

# Cache configurations, routes, and views for optimal performance.
# These must succeed: an uncached config means every config() call re-parses
# a file from disk on every request, an uncached route table means the router
# is rebuilt per request. Failing the boot surfaces the problem in the deploy
# log instead of silently serving a much slower app.
echo "Caching configurations..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Prune the research telemetry in the background. The retention window keeps
# the telemetry tables from growing without bound, and running it off the
# request path keeps a large backlog from delaying the boot. Hosts with a
# cron run the same command from the scheduler instead.
if [ "${ABLE_PRUNE_ON_BOOT:-1}" = "1" ]; then
    echo "Pruning research telemetry in the background..."
    php artisan able:prune-telemetry --no-interaction &
fi

echo "Starting Apache on port ${PORT}..."
exec apache2-foreground
