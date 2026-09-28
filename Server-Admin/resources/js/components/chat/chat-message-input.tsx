import { FileText, Paperclip, SendHorizonal, Smile, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { EmojiPicker } from '@/components/chat/emoji-picker';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const ALLOWED_EXTENSIONS = new Set([
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico',
    // Office files (PDF, Word, Excel, PowerPoint, OpenOffice, RTF)
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'csv',
    // Text files
    'txt', 'md', 'json', 'log', 'xml', 'html', 'htm', 'yml', 'yaml', 'ini', 'cfg', 'conf',
]);

const ACCEPTED_FILE_TYPES = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.json,.md,.log,.xml,.html,.htm,.yml,.yaml,.ini,.cfg,.conf';

function isAllowedFileType(file: File): boolean {
    if (file.type.startsWith('image/') || file.type.startsWith('text/')) {
        return true;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    return ALLOWED_EXTENSIONS.has(ext);
}

function formatBytes(bytes: number): string {
    if (bytes === 0) {
return '0 B';
}

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ChatMessageInput({
    onSend,
    disabled = false,
    placeholder = 'Type a message...',
    autoFocus = false,
    compact = false,
}: {
    onSend: (body: string, attachment?: File | null) => void;
    disabled?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    compact?: boolean;
}) {
    const [value, setValue] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resize = useCallback(() => {
        const el = textareaRef.current;

        if (!el) {
            return;
        }

        el.style.height = 'auto';
        const minHeight = compact ? 44 : 50;
        const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), 180);
        el.style.height = `${newHeight}px`;
    }, [compact]);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        setFileError(null);

        if (!file) {
            return;
        }

        if (!isAllowedFileType(file)) {
            setFileError('Only image, office (PDF, Word, Excel, PowerPoint), and text files are allowed.');

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setFileError('File size exceeds the 20MB limit.');

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            return;
        }

        setAttachment(file);
    }

    function removeAttachment() {
        setAttachment(null);
        setFileError(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    function handleEmojiSelect(emoji: string) {
        const textarea = textareaRef.current;

        if (!textarea) {
            setValue((prev) => prev + emoji);

            return;
        }

        const start = textarea.selectionStart ?? value.length;
        const end = textarea.selectionEnd ?? value.length;
        const nextValue = value.substring(0, start) + emoji + value.substring(end);

        setValue(nextValue);

        requestAnimationFrame(() => {
            textarea.focus();
            const nextCursor = start + emoji.length;
            textarea.setSelectionRange(nextCursor, nextCursor);
            resize();
        });
    }

    function submit() {
        const body = value.trim();

        if ((!body && !attachment) || disabled) {
            return;
        }

        onSend(body, attachment);
        setValue('');
        setAttachment(null);
        setFileError(null);
        setShowEmojiPicker(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        });
    }

    return (
        <div className="relative flex flex-col gap-2.5">
            {/* Error Message */}
            {fileError && (
                <div className="flex items-center justify-between rounded-xl bg-red-500/10 px-3.5 py-2 text-sm text-red-500">
                    <span>{fileError}</span>
                    <button
                        type="button"
                        onClick={() => setFileError(null)}
                        className="text-red-500 hover:text-red-700"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Attachment Preview Chip */}
            {attachment && (
                <div className={cn(
                    'flex items-center gap-2 self-start border border-[rgba(34,197,94,0.4)] bg-white/70 text-foreground shadow-sm backdrop-blur-[10px] dark:border-[rgba(34,197,94,0.5)] dark:bg-[rgba(15,23,42,0.6)]',
                    compact ? 'rounded-xl px-3 py-1.5 text-xs' : 'rounded-2xl px-4 py-2 text-sm',
                )}>
                    <FileText size={compact ? 16 : 18} className="text-able-green shrink-0" />
                    <span className="max-w-[180px] sm:max-w-[220px] truncate font-medium">
                        {attachment.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        ({formatBytes(attachment.size)})
                    </span>
                    <button
                        type="button"
                        onClick={removeAttachment}
                        aria-label="Remove attachment"
                        className="ml-1 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
                    >
                        <X size={compact ? 14 : 16} />
                    </button>
                </div>
            )}

            {/* Input and Action Buttons Row */}
            <div className="flex items-end gap-2.5">
                {/* Textarea container with Emoji button inside on the right */}
                <div className="relative flex-1 min-w-0">
                    {/* Emoji Picker Popover positioned directly above the smiley button */}
                    {showEmojiPicker && (
                        <EmojiPicker
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    )}

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
                            'block w-full resize-none border border-[rgba(34,197,94,0.4)] bg-black/5 leading-6 text-foreground transition-colors outline-none max-h-[180px]',
                            compact
                                ? 'rounded-xl py-2.5 pr-10 pl-3.5 text-sm min-h-[44px]'
                                : 'rounded-2xl py-3 pr-12 pl-4 text-base min-h-[50px]',
                            'placeholder:text-muted-foreground focus:border-able-green focus:ring-[3px] focus:ring-[rgba(34,197,94,0.15)]',
                            'dark:border-[rgba(34,197,94,0.7)] dark:bg-[rgba(15,23,42,0.4)]',
                            'disabled:opacity-50',
                        )}
                        disabled={disabled}
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker((prev) => !prev)}
                        disabled={disabled}
                        aria-label="Choose emoji"
                        title="Emoji"
                        className={cn(
                            'absolute flex items-center justify-center text-muted-foreground transition-colors hover:bg-white/20 hover:text-foreground dark:hover:bg-white/10',
                            compact
                                ? 'right-2 bottom-1.5 h-7 w-7 rounded-lg'
                                : 'right-2.5 bottom-2 h-8 w-8 rounded-xl',
                            showEmojiPicker && 'text-able-green',
                        )}
                    >
                        <Smile size={compact ? 20 : 24} />
                    </button>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                />

                {/* Paperclip button - Sits before Send icon */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    aria-label="Attach file (Images, Office documents, Text files up to 20MB)"
                    title="Attach file: Images, Office, Text (max 20MB)"
                    className={cn(
                        'flex shrink-0 items-center justify-center border border-[rgba(34,197,94,0.4)] bg-black/5 text-muted-foreground transition-all',
                        compact
                            ? 'h-[44px] w-[44px] rounded-xl'
                            : 'h-[50px] w-[50px] rounded-2xl',
                        'hover:border-able-green hover:bg-[rgba(34,197,94,0.1)] hover:text-able-green',
                        'dark:border-[rgba(34,197,94,0.5)] dark:bg-[rgba(15,23,42,0.4)] dark:hover:bg-[rgba(34,197,94,0.15)]',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        attachment && 'border-able-green text-able-green bg-[rgba(34,197,94,0.1)]',
                    )}
                >
                    <Paperclip size={compact ? 20 : 24} />
                </button>

                {/* Send button */}
                <button
                    type="button"
                    onClick={submit}
                    disabled={
                        disabled ||
                        (value.trim().length === 0 && !attachment)
                    }
                    aria-label="Send message"
                    className={cn(
                        'flex shrink-0 items-center justify-center bg-able-green text-white transition-all hover:bg-able-green-muted disabled:cursor-not-allowed disabled:opacity-40',
                        compact
                            ? 'h-[44px] w-[44px] rounded-xl'
                            : 'h-[50px] w-[50px] rounded-2xl',
                    )}
                >
                    <SendHorizonal size={compact ? 20 : 24} />
                </button>
            </div>
        </div>
    );
}
