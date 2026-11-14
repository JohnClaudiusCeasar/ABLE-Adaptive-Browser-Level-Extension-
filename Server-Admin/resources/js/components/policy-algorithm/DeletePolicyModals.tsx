interface DeletePolicyModalsProps {
    deleteConfirmId: number | null;
    deleteAllConfirm: boolean;
    onCancelSingle: () => void;
    onConfirmSingle: (id: number) => void;
    onCancelAll: () => void;
    onConfirmAll: () => void;
}

export function DeletePolicyModals({
    deleteConfirmId,
    deleteAllConfirm,
    onCancelSingle,
    onConfirmSingle,
    onCancelAll,
    onConfirmAll,
}: DeletePolicyModalsProps) {
    return (
        <>
            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-[rgba(248,113,113,0.3)] bg-white p-6 shadow-2xl dark:bg-[#0f172a]">
                        <h3
                            className="mb-2 text-lg font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Delete Domain Policy
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete this domain policy?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onCancelSingle}
                                className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onConfirmSingle(deleteConfirmId)}
                                className="rounded-lg bg-[#f87171] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#ef4444]"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteAllConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-sm rounded-xl border border-[rgba(248,113,113,0.3)] bg-white p-6 shadow-2xl dark:bg-[#0f172a]">
                        <h3
                            className="mb-2 text-lg font-semibold"
                            style={{ fontFamily: "'Unbounded', sans-serif" }}
                        >
                            Delete All Domain Policies
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                            Are you sure you want to delete <strong>all</strong>{' '}
                            domain policies? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onCancelAll}
                                className="rounded-lg border border-black/10 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground dark:border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirmAll}
                                className="rounded-lg bg-[#f87171] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#ef4444]"
                            >
                                Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
