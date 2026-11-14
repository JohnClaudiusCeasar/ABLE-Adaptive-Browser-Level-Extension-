import { usePage } from '@inertiajs/react';
import { CriteriaPatternForm } from './criteria-pattern-form';
import type { RiskPattern } from './criteria-pattern-form';

interface PageProps {
    existingPatterns: RiskPattern[];
    [key: string]: unknown;
}

export default function CreateCriteriaPattern() {
    const { existingPatterns } = usePage<PageProps>().props;

    return (
        <CriteriaPatternForm
            mode="create"
            existingPatterns={existingPatterns}
        />
    );
}

CreateCriteriaPattern.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        { title: 'Risk Policy', href: '/risk-algorithm/criteria' },
        {
            title: 'Create Criteria Pattern',
            href: '/risk-algorithm/criteria/create',
        },
    ],
};
