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

# Run database migrations with retry loop
echo "Waiting for database and running migrations..."
n=0
until [ "$n" -ge 10 ]
do
    php artisan migrate --force --no-interaction && break
    n=$((n+1))
    echo "Database not ready yet, retrying in 3 seconds ($n/10)..."
    sleep 3
done

# Seed default risk patterns and domain policies if empty
echo "Checking seeders..."
php artisan db:seed --class=RiskPatternSeeder --force --no-interaction || true
php artisan db:seed --class=DomainBrandSeeder --force --no-interaction || true

# Cache configurations, routes, and views for optimal performance
echo "Caching configurations..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

echo "Starting Apache on port ${PORT}..."
exec apache2-foreground
