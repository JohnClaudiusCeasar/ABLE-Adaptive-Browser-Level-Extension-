import { SendHorizonal } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function ChatMessageInput({
    onSend,
    disabled = false,
    placeholder = 'Type a message...',
    autoFocus = false,
}: {
    onSend: (body: string) => void;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const resize = useCallback(() => {
        const el = textareaRef.current;

        if (!el) {
            return;
        }

        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, []);

    function submit() {
        const body = value.trim();

        if (!body || disabled) {
            return;
        }

        onSend(body);
        setValue('');

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        });
    }

    return (
        <div className="flex items-end gap-2">
            <textarea
                ref={textareaRef}
                value={value}
                rows={1}
                autoFocus={autoFocus}
                placeholder={placeholder}
                onChange={(e) => {
                    setValue(e.target.value);
                    resize();
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                    }
                }}
                className={cn(
                    'flex-1 resize-none rounded-xl border border-[rgba(34,197,94,0.4)] bg-black/5 px-4 py-2.5 text-sm text-foreground transition-colors outline-none',
                    'placeholder:text-muted-foreground focus:border-able-green focus:ring-[3px] focus:ring-[rgba(34,197,94,0.15)]',
                    'dark:border-[rgba(34,197,94,0.7)] dark:bg-[rgba(15,23,42,0.4)]',
                    'disabled:opacity-50',
                )}
                disabled={disabled}
            />
            <button
                type="button"
                onClick={submit}
                disabled={disabled || value.trim().length === 0}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-able-green text-white transition-all hover:bg-able-green-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
                <SendHorizonal size={18} />
            </button>
        </div>
    );
}
