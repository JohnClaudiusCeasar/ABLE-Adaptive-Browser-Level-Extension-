# Stage 1: Build application assets (PHP + Composer + Node + pnpm)
FROM php:8.4-cli-alpine AS builder

# Install system dependencies, PHP extensions, and Node.js
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    unzip \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    icu-dev \
    sqlite-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd zip pdo pdo_sqlite bcmath intl pcntl

# Install Composer from official image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Step 1: Install Composer dependencies.
# --no-scripts: the post-autoload-dump hook calls `php artisan`, which
# doesn't exist yet at this point (only composer.json/lock are copied).
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader --ignore-platform-reqs

# Step 2: Install Node dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Step 3: Copy full source code, then build the autoloader and run
# Laravel package discovery now that `artisan` is present.
COPY . .
RUN composer dump-autoload --no-dev --optimize

# Step 4: Generate Wayfinder bridge files and compile frontend assets
RUN php artisan wayfinder:generate --with-form
RUN pnpm run build

# Stage 2: Production runtime (Apache + PHP 8.4)
FROM php:8.4-apache

# Install required system packages & PHP extensions for runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    libpq-dev \
    libsqlite3-dev \
    zip \
    unzip \
    sqlite3 \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        bcmath \
        gd \
        opcache \
        pcntl \
        pdo \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
RUN a2enmod rewrite headers

# Copy Apache config
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Copy application code
COPY . .

# Copy compiled frontend assets from builder stage
COPY --from=builder /app/public/build ./public/build

# Copy vendor dependencies from builder stage
COPY --from=builder /app/vendor ./vendor

# Copy the package manifest built for production (no dev packages)
COPY --from=builder /app/bootstrap/cache ./bootstrap/cache

# Copy entrypoint script and set permissions
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
