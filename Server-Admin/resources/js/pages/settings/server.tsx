import { Form, Head, usePage } from '@inertiajs/react';
import ServerSettingsController from '@/actions/App/Http/Controllers/Settings/ServerSettingsController';
import Heading from '@/components/heading';
import { AdvancedDisclosure } from '@/components/settings/advanced-disclosure';
import { ArrayField } from '@/components/settings/array-field';
import { BooleanField } from '@/components/settings/boolean-field';
import { KeyValueField } from '@/components/settings/key-value-field';
import { NumberField } from '@/components/settings/number-field';
import { PolicySelect } from '@/components/settings/policy-select';
import { RiskThresholdSlider } from '@/components/settings/risk-threshold-slider';
import { SettingsField } from '@/components/settings/settings-field';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsStatusBanner } from '@/components/settings/settings-status-banner';
import { TextField } from '@/components/settings/text-field';
import { Button } from '@/components/ui/button';
import type { SettingsValues } from '@/lib/settings';
import { edit } from '@/routes/server-settings';

type Ut1Run = {
    ran_at: string;
    created: number;
    updated: number;
    skipped: number;
    url?: string;
} | null;

type ServerStatus = {
    signing_key_ok: boolean;
    key_version: number;
    ut1_enabled: boolean;
    ut1_last_run: Ut1Run;
    ut1_url_fallback: string;
    policy_counts: Record<string, number>;
    notification_sync_on: boolean;
    audit_on: boolean;
    api_rate_limit: number;
    extension_threshold: number;
    server_threshold: number;
};

type PageProps = {
    settings: SettingsValues;
    status?: ServerStatus;
};

export default function ServerSettings() {
    const { settings, status } = usePage<PageProps>().props;

    const ut1 = status?.ut1_last_run;
    const thresholdsMatch =
        (status?.extension_threshold ?? 0) === (status?.server_threshold ?? 0);

    return (
        <>
            <Head title="Server settings" />

            <h1 className="sr-only">Server settings</h1>

            <div className="space-y-8">
                <Heading
                    variant="small"
                    title="Server"
                    description="How this admin server classifies sites and stores reports"
                />

                {status && (
                    <SettingsStatusBanner
                        title="Server health"
                        items={[
                            {
                                label: 'Update signing',
                                value: status.signing_key_ok
                                    ? `Working (key v${status.key_version})`
                                    : 'Not configured — set ABLE_SIGNING_KEY',
                                tone: status.signing_key_ok ? 'ok' : 'bad',
                            },
                            {
                                label: 'Known sites',
                                value: `${status.policy_counts.whitelisted ?? 0} allowed · ${status.policy_counts.blacklisted ?? 0} blocked · ${status.policy_counts.under_review ?? 0} in review`,
                                tone: 'muted',
                            },
                            {
                                label: 'External blocklist',
                                value: !status.ut1_enabled
                                    ? 'Off'
                                    : ut1
                                      ? `Imported ${ut1.created + ut1.updated} sites (${ut1.ran_at})`
                                      : 'On — never imported',
                                tone:
                                    status.ut1_enabled && !ut1
                                        ? 'warn'
                                        : 'muted',
                            },
                            {
                                label: 'Background tasks',
                                value: [
                                    status.notification_sync_on
                                        ? 'Notifications on'
                                        : 'Notifications off',
                                    status.audit_on ? 'Audit on' : 'Audit off',
                                ].join(' · '),
                                tone: 'muted',
                            },
                        ]}
                    />
                )}

                <Form
                    {...ServerSettingsController.update.form()}
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
                                    label="What to do with unknown sites"
                                    description="Default action when a site has no saved rule."
                                    error={errors['algorithm.fallback_policy']}
                                >
                                    <PolicySelect
                                        name="algorithm.fallback_policy"
                                        defaultValue={
                                            settings[
                                                'algorithm.fallback_policy'
                                            ] as string
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Risk score for unknown sites"
                                    description="Score given to unknown sites (0 safe, 100 dangerous)."
                                    error={
                                        errors['algorithm.default_risk_score']
                                    }
                                >
                                    <RiskThresholdSlider
                                        name="algorithm.default_risk_score"
                                        defaultValue={
                                            settings[
                                                'algorithm.default_risk_score'
                                            ] as number
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Block threshold"
                                    description="Block a site when its score passes this."
                                    error={
                                        errors[
                                            'algorithm.default_risk_threshold'
                                        ]
                                    }
                                >
                                    <RiskThresholdSlider
                                        name="algorithm.default_risk_threshold"
                                        defaultValue={
                                            settings[
                                                'algorithm.default_risk_threshold'
                                            ] as number
                                        }
                                    />
                                    {status && !thresholdsMatch && (
                                        <p className="text-xs text-amber-500">
                                            Extensions block at{' '}
                                            {status.extension_threshold} — keep
                                            them aligned unless testing.
                                        </p>
                                    )}
                                </SettingsField>

                                <SettingsField
                                    label="Auto-categorize new sites"
                                    description="Guess a category for unknown sites from page details sent by the extension."
                                    error={
                                        errors[
                                            'algorithm.auto_categorize_enabled'
                                        ]
                                    }
                                >
                                    <BooleanField
                                        name="algorithm.auto_categorize_enabled"
                                        defaultValue={
                                            settings[
                                                'algorithm.auto_categorize_enabled'
                                            ] as boolean
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="External blocklist"
                                    description="Import site categories weekly from the UT1 list."
                                    error={errors['ut1.sync_enabled']}
                                >
                                    <BooleanField
                                        name="ut1.sync_enabled"
                                        defaultValue={
                                            settings[
                                                'ut1.sync_enabled'
                                            ] as boolean
                                        }
                                    />
                                    {ut1 && (
                                        <p className="text-xs text-muted-foreground">
                                            Last import: {ut1.created} added,{' '}
                                            {ut1.updated} updated, {ut1.skipped}{' '}
                                            skipped.
                                        </p>
                                    )}
                                </SettingsField>

                                <SettingsField
                                    label="Blocklist download URL"
                                    description={`Where the weekly list is downloaded from. Server default: ${status?.ut1_url_fallback ?? 'built-in'}.`}
                                    error={errors['ut1.sync_url']}
                                >
                                    <TextField
                                        name="ut1.sync_url"
                                        defaultValue={
                                            settings['ut1.sync_url'] as string
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="API speed limit"
                                    description="Max classification requests per minute."
                                    error={errors['runtime.api_rate_limit']}
                                >
                                    <NumberField
                                        name="runtime.api_rate_limit"
                                        defaultValue={
                                            settings[
                                                'runtime.api_rate_limit'
                                            ] as number
                                        }
                                        min={1}
                                        max={10000}
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <AdvancedDisclosure>
                                <SettingsField
                                    label="Trusted site patterns"
                                    description="Sites matching these patterns count as safe without a saved rule. One pattern per line."
                                    error={errors['algorithm.safe_patterns']}
                                >
                                    <ArrayField
                                        name="algorithm.safe_patterns"
                                        defaultValue={
                                            settings[
                                                'algorithm.safe_patterns'
                                            ] as string[]
                                        }
                                        placeholder={
                                            '/^([\\w-]+\\.)*\\.(edu|gov|org)$/i'
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Server identity pins"
                                    description="Certificate pins per server. One server per line."
                                    error={errors['security.tls_pins']}
                                >
                                    <KeyValueField
                                        name="security.tls_pins"
                                        defaultValue={
                                            settings[
                                                'security.tls_pins'
                                            ] as Record<string, string[]>
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Sites excluded from reports"
                                    description="The server ignores reports from these sites. One per line."
                                    error={errors['security.excluded_domains']}
                                >
                                    <ArrayField
                                        name="security.excluded_domains"
                                        defaultValue={
                                            settings[
                                                'security.excluded_domains'
                                            ] as string[]
                                        }
                                        placeholder={'localhost'}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Notifications"
                                    description="Build the notification feed from incoming reports."
                                    error={
                                        errors[
                                            'runtime.notification_sync_enabled'
                                        ]
                                    }
                                >
                                    <BooleanField
                                        name="runtime.notification_sync_enabled"
                                        defaultValue={
                                            settings[
                                                'runtime.notification_sync_enabled'
                                            ] as boolean
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Audit log"
                                    description="Keep a record of who changed protected data."
                                    error={
                                        errors['runtime.audit_logging_enabled']
                                    }
                                >
                                    <BooleanField
                                        name="runtime.audit_logging_enabled"
                                        defaultValue={
                                            settings[
                                                'runtime.audit_logging_enabled'
                                            ] as boolean
                                        }
                                    />
                                </SettingsField>
                            </AdvancedDisclosure>

                            <div className="flex items-center gap-4">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    data-test="save-server-settings"
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

ServerSettings.layout = {
    breadcrumbs: [
        {
            title: 'Server settings',
            href: edit(),
        },
    ],
};
