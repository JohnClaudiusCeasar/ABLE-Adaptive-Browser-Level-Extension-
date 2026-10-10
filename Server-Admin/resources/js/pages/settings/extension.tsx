import { Form, Head, usePage } from '@inertiajs/react';
import ExtensionSettingsController from '@/actions/App/Http/Controllers/Settings/ExtensionSettingsController';
import Heading from '@/components/heading';
import { AdvancedDisclosure } from '@/components/settings/advanced-disclosure';
import { ArrayField } from '@/components/settings/array-field';
import { BooleanField } from '@/components/settings/boolean-field';
import {
    HumanDurationField,
    HumanMinutesField,
} from '@/components/settings/human-duration-field';
import { KeyValueField } from '@/components/settings/key-value-field';
import { NumberField } from '@/components/settings/number-field';
import { RiskThresholdSlider } from '@/components/settings/risk-threshold-slider';
import { SettingsField } from '@/components/settings/settings-field';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsStatusBanner } from '@/components/settings/settings-status-banner';
import { Button } from '@/components/ui/button';
import type { SettingsValues } from '@/lib/settings';
import { edit } from '@/routes/extension-settings';

type ExtensionStatus = {
    signing_key_ok: boolean;
    key_version: number;
    extensions_24h: number;
    egress_today: number;
    egress_cap: number;
    jobs_pending: number;
    extension_threshold: number;
    server_threshold: number;
};

type PageProps = {
    settings: SettingsValues;
    status?: ExtensionStatus;
};

export default function ExtensionSettings() {
    const { settings, status } = usePage<PageProps>().props;

    const thresholdsMatch =
        (status?.extension_threshold ?? 0) === (status?.server_threshold ?? 0);
    const egressNearCap =
        (status?.egress_cap ?? 0) > 0 &&
        (status?.egress_today ?? 0) >= (status?.egress_cap ?? 0) * 0.8;

    return (
        <>
            <Head title="Extension settings" />

            <h1 className="sr-only">Extension settings</h1>

            <div className="space-y-8">
                <Heading
                    variant="small"
                    title="Extension"
                    description="What people with the browser extension experience"
                />

                {status && (
                    <SettingsStatusBanner
                        title="Extension health"
                        items={[
                            {
                                label: 'Update signing',
                                value: status.signing_key_ok
                                    ? `Working (key v${status.key_version})`
                                    : 'Not configured — extensions cannot verify updates',
                                tone: status.signing_key_ok ? 'ok' : 'bad',
                            },
                            {
                                label: 'Active extensions (24h)',
                                value: `${status.extensions_24h}`,
                                tone: 'muted',
                            },
                            {
                                label: 'Upload reports today',
                                value: `${status.egress_today} of ${status.egress_cap}`,
                                tone: egressNearCap ? 'warn' : 'ok',
                            },
                            {
                                label: 'Uploads waiting to sync',
                                value: `${status.jobs_pending}`,
                                tone:
                                    status.jobs_pending > 100
                                        ? 'warn'
                                        : 'muted',
                            },
                        ]}
                    />
                )}

                <Form
                    {...ExtensionSettingsController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-8"
                >
                    {({ errors, processing }) => (
                        <>
                            <SettingsSection
                                title="Everyday"
                                description="The settings you will change most often"
                            >
                                <SettingsField
                                    label="Protection sensitivity"
                                    description="Block an upload when its risk score passes this. Higher blocks more."
                                    error={errors['behavior.risk_threshold']}
                                >
                                    <RiskThresholdSlider
                                        name="behavior.risk_threshold"
                                        defaultValue={
                                            settings[
                                                'behavior.risk_threshold'
                                            ] as number
                                        }
                                    />
                                    {status && !thresholdsMatch && (
                                        <p className="text-xs text-amber-500">
                                            Server default is{' '}
                                            {status.server_threshold} — keep
                                            them aligned unless testing.
                                        </p>
                                    )}
                                </SettingsField>

                                <SettingsField
                                    label="Ask before blocking uploads"
                                    description="Respect the per-site choice a person made during this visit."
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

                                <SettingsField
                                    label="Daily upload-report limit"
                                    description="Max upload reports each person can send per day."
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
                                    {status && (
                                        <p className="text-xs text-muted-foreground">
                                            {status.egress_today} reports sent
                                            today across everyone.
                                        </p>
                                    )}
                                </SettingsField>

                                <SettingsField
                                    label="Ignored sites"
                                    description="The extension fully ignores these sites. One per line."
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

                                <SettingsField
                                    label="Threat list refresh"
                                    description="How often the extension downloads the latest threat list."
                                    error={
                                        errors[
                                            'sync.risk_patterns_interval_minutes'
                                        ]
                                    }
                                >
                                    <HumanMinutesField
                                        name="sync.risk_patterns_interval_minutes"
                                        defaultMinutes={
                                            settings[
                                                'sync.risk_patterns_interval_minutes'
                                            ] as number
                                        }
                                        min={1}
                                        max={10080}
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <AdvancedDisclosure>
                                <SettingsField
                                    label="Reminder pause (short)"
                                    description="Wait this long before reminding about the same site again."
                                    error={
                                        errors[
                                            'behavior.modal_short_cooldown_ms'
                                        ]
                                    }
                                >
                                    <HumanDurationField
                                        name="behavior.modal_short_cooldown_ms"
                                        defaultMs={
                                            settings[
                                                'behavior.modal_short_cooldown_ms'
                                            ] as number
                                        }
                                        unit="seconds"
                                        min={0}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Reminder pause (repeating)"
                                    description="Longer pause used every third reminder on the same site."
                                    error={
                                        errors[
                                            'behavior.modal_stagger_cooldown_ms'
                                        ]
                                    }
                                >
                                    <HumanDurationField
                                        name="behavior.modal_stagger_cooldown_ms"
                                        defaultMs={
                                            settings[
                                                'behavior.modal_stagger_cooldown_ms'
                                            ] as number
                                        }
                                        unit="seconds"
                                        min={0}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Site memory"
                                    description="How long the extension remembers a site's safety rating."
                                    error={errors['sync.cache_ttl_ms']}
                                >
                                    <HumanDurationField
                                        name="sync.cache_ttl_ms"
                                        defaultMs={
                                            settings[
                                                'sync.cache_ttl_ms'
                                            ] as number
                                        }
                                        unit="seconds"
                                        min={1}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Visit report retry"
                                    description="How often queued visit reports are retried."
                                    error={
                                        errors[
                                            'sync.visit_log_flush_interval_minutes'
                                        ]
                                    }
                                >
                                    <HumanMinutesField
                                        name="sync.visit_log_flush_interval_minutes"
                                        defaultMinutes={
                                            settings[
                                                'sync.visit_log_flush_interval_minutes'
                                            ] as number
                                        }
                                        min={1}
                                        max={1440}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Upload report retry"
                                    description="How often queued upload reports are retried."
                                    error={
                                        errors[
                                            'sync.egress_log_flush_interval_minutes'
                                        ]
                                    }
                                >
                                    <HumanMinutesField
                                        name="sync.egress_log_flush_interval_minutes"
                                        defaultMinutes={
                                            settings[
                                                'sync.egress_log_flush_interval_minutes'
                                            ] as number
                                        }
                                        min={1}
                                        max={1440}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Server-error wait"
                                    description="Wait this long after a server error before trying again."
                                    error={
                                        errors[
                                            'logging.rate_limit_default_backoff_ms'
                                        ]
                                    }
                                >
                                    <HumanDurationField
                                        name="logging.rate_limit_default_backoff_ms"
                                        defaultMs={
                                            settings[
                                                'logging.rate_limit_default_backoff_ms'
                                            ] as number
                                        }
                                        unit="seconds"
                                        min={1}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Repeat-visit window"
                                    description="Visits to the same site within this window count as one."
                                    error={errors['logging.visit_debounce_ms']}
                                >
                                    <HumanDurationField
                                        name="logging.visit_debounce_ms"
                                        defaultMs={
                                            settings[
                                                'logging.visit_debounce_ms'
                                            ] as number
                                        }
                                        unit="seconds"
                                        min={0}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Skip search pages"
                                    description="Do not log visits from search result pages (Google, Bing, Yahoo)."
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

                                <SettingsField
                                    label="Allowed servers"
                                    description="Extra servers the extension may contact. One per line. Leave empty to only use your server."
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
                                    label="Server identity pins"
                                    description="Certificate pins per server. One server per line."
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
                            </AdvancedDisclosure>

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
