import { Form, Head, usePage } from '@inertiajs/react';
import ServerSettingsController from '@/actions/App/Http/Controllers/Settings/ServerSettingsController';
import Heading from '@/components/heading';
import { ArrayField } from '@/components/settings/array-field';
import { BooleanField } from '@/components/settings/boolean-field';
import { KeyValueField } from '@/components/settings/key-value-field';
import { NumberField } from '@/components/settings/number-field';
import { SettingsField } from '@/components/settings/settings-field';
import { SettingsSection } from '@/components/settings/settings-section';
import { TextField } from '@/components/settings/text-field';
import { Button } from '@/components/ui/button';
import type { SettingsValues } from '@/lib/settings';
import { edit } from '@/routes/server-settings';

type PageProps = {
    settings: SettingsValues;
};

export default function ServerSettings() {
    const { settings } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Server settings" />

            <h1 className="sr-only">Server settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Server"
                    description="Master control room for how the ABLE admin server behaves"
                />

                <Form
                    {...ServerSettingsController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <SettingsSection
                                title="Algorithm Defaults"
                                description="Fallback values used during domain classification"
                            >
                                <SettingsField
                                    label="Default risk threshold"
                                    description="Fallback threshold used by server-side classification."
                                    error={
                                        errors[
                                            'algorithm.default_risk_threshold'
                                        ]
                                    }
                                >
                                    <NumberField
                                        name="algorithm.default_risk_threshold"
                                        defaultValue={
                                            settings[
                                                'algorithm.default_risk_threshold'
                                            ] as number
                                        }
                                        min={0}
                                        max={100}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Default risk score"
                                    description="Score assigned to unlisted domains."
                                    error={
                                        errors['algorithm.default_risk_score']
                                    }
                                >
                                    <NumberField
                                        name="algorithm.default_risk_score"
                                        defaultValue={
                                            settings[
                                                'algorithm.default_risk_score'
                                            ] as number
                                        }
                                        min={0}
                                        max={100}
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Safe patterns"
                                    description="Regexes that classify a domain as safe when no policy exists. One per line."
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
                                    label="Fallback policy"
                                    description="Policy assigned to unmatched domains."
                                    error={errors['algorithm.fallback_policy']}
                                >
                                    <TextField
                                        name="algorithm.fallback_policy"
                                        defaultValue={
                                            settings[
                                                'algorithm.fallback_policy'
                                            ] as string
                                        }
                                    />
                                </SettingsField>

                                <SettingsField
                                    label="Auto-categorize domains"
                                    description="Auto-assign a category to unlisted domains from page signals sent by the extension."
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
                                    label="UT1 blacklist sync"
                                    description="Allow the weekly UT1 import (able:import-ut1) to upsert domain categories from offline lists."
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
                                </SettingsField>

                                <SettingsField
                                    label="UT1 sync URL"
                                    description="Download URL for the UT1 categorized blacklist tarball."
                                    error={errors['ut1.sync_url']}
                                >
                                    <TextField
                                        name="ut1.sync_url"
                                        defaultValue={
                                            settings[
                                                'ut1.sync_url'
                                            ] as string
                                        }
                                    />
                                </SettingsField>
                            </SettingsSection>

                            <SettingsSection
                                title="Security & Signing"
                                description="TLS pins and excluded domains"
                            >
                                <SettingsField
                                    label="TLS pins"
                                    description="One hostname per line with comma-separated base64 SPKI pins."
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
                                    label="Excluded domains"
                                    description="Server-side domains excluded from telemetry. One per line."
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
                            </SettingsSection>

                            <SettingsSection
                                title="Runtime Behavior"
                                description="Feature gates and API limits"
                            >
                                <SettingsField
                                    label="Notification sync"
                                    description="Enable notification sync from source tables."
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
                                    label="Audit logging"
                                    description="Enable audit logging of admin-editable entities."
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

                                <SettingsField
                                    label="API rate limit"
                                    description="Default per-minute API throttle for classification."
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
