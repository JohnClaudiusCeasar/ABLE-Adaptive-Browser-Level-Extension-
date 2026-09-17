import { Form, Head, usePage } from '@inertiajs/react';
import ExtensionSettingsController from '@/actions/App/Http/Controllers/Settings/ExtensionSettingsController';
import Heading from '@/components/heading';
import { ArrayField } from '@/components/settings/array-field';
import { BooleanField } from '@/components/settings/boolean-field';
import { KeyValueField } from '@/components/settings/key-value-field';
import { NumberField } from '@/components/settings/number-field';
import { SettingsField } from '@/components/settings/settings-field';
import { SettingsSection } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import type { SettingsValues } from '@/lib/settings';
import { edit } from '@/routes/extension-settings';

type PageProps = {
    settings: SettingsValues;
};

export default function ExtensionSettings() {
    const { settings } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Extension settings" />

            <h1 className="sr-only">Extension settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Extension"
                    description="Master control room for how the ABLE browser extension behaves"
                />

                <Form
                    {...ExtensionSettingsController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <SettingsSection
                                title="Behavior"
                                description="Detection thresholds and modal cooldowns"
                            >
                                <SettingsField
                                    label="Risk threshold"
                                    description="Intercept an upload when its risk score exceeds this value."
                                    error={errors['behavior.risk_threshold']}
                                >
                                    <NumberField
                                        name="behavior.risk_threshold"
                                        defaultValue={
                                            settings[
                                                'behavior.risk_threshold'
                                            ] as number
                                        }
                                        min={0}
                                        max={100}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Short modal cooldown (ms)"
                                    description="Cooldown between quick repeat-visit modals."
                                    error={
                                        errors[
                                            'behavior.modal_short_cooldown_ms'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="behavior.modal_short_cooldown_ms"
                                        defaultValue={
                                            settings[
                                                'behavior.modal_short_cooldown_ms'
                                            ] as number
                                        }
                                        min={0}
                                        max={3600000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Staggered modal cooldown (ms)"
                                    description="Cooldown used every third repeat-visit interaction."
                                    error={
                                        errors[
                                            'behavior.modal_stagger_cooldown_ms'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="behavior.modal_stagger_cooldown_ms"
                                        defaultValue={
                                            settings[
                                                'behavior.modal_stagger_cooldown_ms'
                                            ] as number
                                        }
                                        min={0}
                                        max={3600000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Session consent"
                                    description="Honor per-domain session consent before intercepting uploads."
                                    error={
                                        errors[
                                            'behavior.session_consent_enabled'
                                        ]
                                    }
                                >
                                    <BooleanField
                                        name="behavior.session_consent_enabled"
                                        defaultValue={
                                            settings[
                                                'behavior.session_consent_enabled'
                                            ] as boolean
                                        }
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <SettingsSection
                                title="Sync"
                                description="Caching and background synchronization intervals"
                            >
                                <SettingsField
                                    label="Classification cache TTL (ms)"
                                    description="How long in-memory domain classifications are reused."
                                    error={errors['sync.cache_ttl_ms']}
                                >
                                    <NumberField
                                        name="sync.cache_ttl_ms"
                                        defaultValue={
                                            settings[
                                                'sync.cache_ttl_ms'
                                            ] as number
                                        }
                                        min={1000}
                                        max={86400000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Risk pattern sync interval (minutes)"
                                    description="How often the extension refreshes risk patterns."
                                    error={
                                        errors[
                                            'sync.risk_patterns_interval_minutes'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="sync.risk_patterns_interval_minutes"
                                        defaultValue={
                                            settings[
                                                'sync.risk_patterns_interval_minutes'
                                            ] as number
                                        }
                                        min={1}
                                        max={10080}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Visit log flush interval (minutes)"
                                    description="How often queued visit logs are retried."
                                    error={
                                        errors[
                                            'sync.visit_log_flush_interval_minutes'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="sync.visit_log_flush_interval_minutes"
                                        defaultValue={
                                            settings[
                                                'sync.visit_log_flush_interval_minutes'
                                            ] as number
                                        }
                                        min={1}
                                        max={1440}
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <SettingsSection
                                title="Connection & Security"
                                description="Allowed origins and TLS certificate pins"
                            >
                                <SettingsField
                                    label="Allowed origins"
                                    description="Origins the extension may contact. One per line."
                                    error={errors['connection.allowed_origins']}
                                >
                                    <ArrayField
                                        name="connection.allowed_origins"
                                        defaultValue={
                                            settings[
                                                'connection.allowed_origins'
                                            ] as string[]
                                        }
                                        placeholder={
                                            'https://able-admin.internal:8443'
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="TLS pins"
                                    description="One hostname per line with comma-separated base64 SPKI pins."
                                    error={errors['connection.tls_pins']}
                                >
                                    <KeyValueField
                                        name="connection.tls_pins"
                                        defaultValue={
                                            settings[
                                                'connection.tls_pins'
                                            ] as Record<string, string[]>
                                        }
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <SettingsSection
                                title="Logging & Limits"
                                description="Rate limits, debounce, and egress caps"
                            >
                                <SettingsField
                                    label="Default 429 backoff (ms)"
                                    description="Backoff used when the server omits a Retry-After header."
                                    error={
                                        errors[
                                            'logging.rate_limit_default_backoff_ms'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="logging.rate_limit_default_backoff_ms"
                                        defaultValue={
                                            settings[
                                                'logging.rate_limit_default_backoff_ms'
                                            ] as number
                                        }
                                        min={1000}
                                        max={600000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Daily egress cap"
                                    description="Per-user daily cap for egress log submissions."
                                    error={errors['logging.daily_egress_cap']}
                                >
                                    <NumberField
                                        name="logging.daily_egress_cap"
                                        defaultValue={
                                            settings[
                                                'logging.daily_egress_cap'
                                            ] as number
                                        }
                                        min={1}
                                        max={100000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Visit debounce (ms)"
                                    description="Same-domain visit debounce window."
                                    error={errors['logging.visit_debounce_ms']}
                                >
                                    <NumberField
                                        name="logging.visit_debounce_ms"
                                        defaultValue={
                                            settings[
                                                'logging.visit_debounce_ms'
                                            ] as number
                                        }
                                        min={0}
                                        max={3600000}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Skip search result visits"
                                    description="Skip domain visit auditing for search engine result listings (e.g. Google, Yahoo, Bing)."
                                    error={
                                        errors['logging.skip_search_results']
                                    }
                                >
                                    <BooleanField
                                        name="logging.skip_search_results"
                                        defaultValue={
                                            settings[
                                                'logging.skip_search_results'
                                            ] as boolean
                                        }
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <SettingsSection
                                title="Excluded Domains"
                                description="Domains the extension ignores entirely"
                            >
                                <SettingsField
                                    label="Excluded domains"
                                    description="One domain per line."
                                    error={errors.excluded_domains}
                                >
                                    <ArrayField
                                        name="excluded_domains"
                                        defaultValue={
                                            settings.excluded_domains as string[]
                                        }
                                        placeholder={'localhost'}
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <div className="flex items-center gap-4">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    data-test="save-extension-settings"
                                >
                                    Save
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

ExtensionSettings.layout = {
    breadcrumbs: [
        {
            title: 'Extension settings',
            href: edit(),
        },
    ],
};
