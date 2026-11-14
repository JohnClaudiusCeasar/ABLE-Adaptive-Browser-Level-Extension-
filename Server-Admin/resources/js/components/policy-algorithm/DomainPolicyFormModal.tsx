import { X } from 'lucide-react';
import type { FormEvent } from 'react';
import { CategoryPicker } from './CategoryPicker';
import type { CategoryOption, DomainPolicyFormData } from './types';

interface DomainPolicyFormModalProps {
    open: boolean;
    editingId: number | null;
    form: DomainPolicyFormData;
    setForm: (form: DomainPolicyFormData) => void;
    formErrors: Record<string, string>;
    isSubmitting: boolean;
    categories: CategoryOption[];
    onClose: () => void;
    onSubmit: (e: FormEvent) => void;
}

export function DomainPolicyFormModal({
    open,
    editingId,
    form,
    setForm,
    formErrors,
    isSubmitting,
    categories,
    onClose,
    onSubmit,
}: DomainPolicyFormModalProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
            <div className="mx-4 max-h-[75vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[rgba(34,197,94,0.3)] bg-white shadow-2xl dark:bg-[#0f172a]">
                <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
                    <h3
                        className="text-lg font-bold"
                        style={{
                            fontFamily: "'Unbounded', sans-serif",
                        }}
                    >
                        {editingId ? 'Edit Domain Policy' : 'Add Domain Policy'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                            Domain Name
                        </label>
                        <input
                            type="text"
                            required
                            readOnly={!!editingId}
                            value={form.domain}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    domain: e.target.value,
                                })
                            }
                            placeholder="e.g., example.com"
                            className={`w-full rounded-lg border bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green ${formErrors.domain ? 'border-[#f87171]' : 'border-black/10 dark:border-white/10'} ${editingId ? 'cursor-not-allowed opacity-60' : ''}`}
                        />
                        {formErrors.domain && (
                            <p className="mt-1 text-xs text-[#f87171]">
                                {formErrors.domain}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                Domain Status
                            </label>
                            <select
                                value={form.domain_status}
                                disabled={
                                    form.policy === 'whitelisted' ||
                                    form.policy === 'blacklisted'
                                }
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        domain_status: e.target
                                            .value as DomainPolicyFormData['domain_status'],
                                    })
                                }
                                className={`w-full rounded-lg border bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green ${
                                    form.policy === 'whitelisted' ||
                                    form.policy === 'blacklisted'
                                        ? 'cursor-not-allowed border-black/10 bg-black/5 opacity-60 dark:border-white/10 dark:bg-white/5'
                                        : 'border-black/10 dark:border-white/10'
                                }`}
                            >
                                <option value="safe">Safe</option>
                                <option value="unsafe">Unsafe</option>
                                <option value="unlisted">Unlisted</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">
                                Policy
                            </label>
                            <select
                                value={form.policy}
                                onChange={(e) => {
                                    const policy = e.target
                                        .value as DomainPolicyFormData['policy'];
                                    const statusMap: Record<
                                        DomainPolicyFormData['policy'],
                                        DomainPolicyFormData['domain_status']
                                    > = {
                                        whitelisted: 'safe',
                                        blacklisted: 'unsafe',
                                        under_review: 'unlisted',
                                    };
                                    setForm({
                                        ...form,
                                        policy,
                                        block_access:
                                            policy === 'blacklisted'
                                                ? form.block_access
                                                : false,
                                        domain_status: statusMap[policy],
                                        risk_score:
                                            policy === 'blacklisted'
                                                ? 70
                                                : policy === 'whitelisted'
                                                  ? 0
                                                  : policy === 'under_review'
                                                    ? 60
                                                    : form.risk_score,
                                    });
                                }}
                                className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                            >
                                <option value="whitelisted">Whitelisted</option>
                                <option value="blacklisted">Blacklisted</option>
                                <option value="under_review">
                                    Under Review
                                </option>
                            </select>
                            {form.policy === 'blacklisted' && (
                                <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2.5 shadow-sm">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-red-500 uppercase">
                                            <svg
                                                width="13"
                                                height="13"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                aria-hidden="true"
                                            >
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                />
                                                <line
                                                    x1="4.93"
                                                    y1="4.93"
                                                    x2="19.07"
                                                    y2="19.07"
                                                />
                                            </svg>
                                            Block Access
                                        </span>
                                        <span className="text-[11px] leading-snug text-muted-foreground">
                                            Instruct extension to block user
                                            access to this site
                                        </span>
                                    </div>
                                    <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="peer sr-only"
                                            checked={form.block_access}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    block_access:
                                                        e.target.checked,
                                                })
                                            }
                                        />
                                        <span className="absolute inset-0 rounded-full border border-black/10 bg-black/15 transition-colors peer-checked:border-red-500 peer-checked:bg-red-500 dark:border-white/10 dark:bg-white/15" />
                                        <span className="absolute bottom-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[20px]" />
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                            Category
                        </label>
                        <CategoryPicker
                            value={form.category}
                            categories={categories}
                            onChange={(category) =>
                                setForm({
                                    ...form,
                                    category,
                                    classification_source: 'manual',
                                })
                            }
                        />
                        <input
                            type="hidden"
                            value={form.classification_source}
                            readOnly
                        />
                        {form.policy === 'whitelisted' && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {form.category
                                    ? `Whitelisted domains appear under ABLE Recommends for "${form.category}".`
                                    : 'Whitelisted domains appear under ABLE Recommends for their category. Set a category to enable it.'}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                            Risk Score (0-100)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            required
                            value={form.risk_score}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    risk_score: parseInt(e.target.value) || 0,
                                })
                            }
                            className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-foreground transition-colors outline-none focus:border-able-green dark:border-white/10"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-able-green px-4 py-2 font-semibold text-white transition-colors hover:bg-[#1a9e4b] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting
                                ? 'Saving...'
                                : editingId
                                  ? 'Update'
                                  : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
