import { usePage } from '@inertiajs/react';
import { CriteriaPatternForm } from './criteria-pattern-form';
import type { RiskPattern } from './criteria-pattern-form';

interface PageProps {
    riskPattern: RiskPattern;
    existingPatterns: RiskPattern[];
    [key: string]: unknown;
}

export default function EditCriteriaPattern() {
    const { riskPattern, existingPatterns } = usePage<PageProps>().props;

    return (
        <CriteriaPatternForm
            mode="edit"
            riskPattern={riskPattern}
            existingPatterns={existingPatterns}
        />
    );
}

EditCriteriaPattern.layout = {
    breadcrumbs: [
        { title: 'Policy Administration', href: '/risk-algorithm/criteria' },
        { title: 'Risk Policy', href: '/risk-algorithm/criteria' },
        {
            title: 'Edit Criteria Pattern',
            href: '#',
        },
    ],
};
