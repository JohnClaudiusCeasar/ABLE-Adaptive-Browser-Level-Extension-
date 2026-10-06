# Stage 1: Build frontend assets
FROM node:22-alpine AS frontend
WORKDIR /app
RUN apk add --no-cache php php-cli php-phar php-mbstring php-openssl php-tokenizer
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Install PHP Composer dependencies
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs

# Stage 3: Production PHP + Apache server
FROM php:8.4-apache

# Install required system libraries and PHP extensions
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

# Copy Apache virtualhost config
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Copy application files
COPY . .

# Copy compiled frontend assets from Stage 1
COPY --from=frontend /app/public/build ./public/build

# Copy vendor dependencies from Stage 2
COPY --from=vendor /app/vendor ./vendor

# Copy and set entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set directory permissions for Laravel
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
