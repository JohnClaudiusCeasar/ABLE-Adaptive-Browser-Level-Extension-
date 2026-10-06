<?php

namespace App\Providers;

use App\Listeners\LoginActivityListener;
use App\Models\AbleSetting;
use App\Models\CriteriaPatternItem;
use App\Models\DomainPolicy;
use App\Models\RiskPattern;
use App\Observers\AuditLogObserver;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);
        $this->configureDefaults();
        $this->registerEventListeners();
        $this->registerModelObservers();
    }

    /**
     * Register model observers for audit logging of admin-editable entities.
     */
    protected function registerModelObservers(): void
    {
        DomainPolicy::observe(AuditLogObserver::class);
        RiskPattern::observe(AuditLogObserver::class);
        CriteriaPatternItem::observe(AuditLogObserver::class);
        AbleSetting::observe(AuditLogObserver::class);
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        if (app()->isProduction() || str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Register event listeners for login audit logging.
     */
    protected function registerEventListeners(): void
    {
        Event::listen(Login::class, [LoginActivityListener::class, 'handleLogin']);
        Event::listen(Failed::class, [LoginActivityListener::class, 'handleFailed']);
        Event::listen(Logout::class, [LoginActivityListener::class, 'handleLogout']);
    }
}
