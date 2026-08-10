import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { ChatUser } from '@/types/chat';

export function ChatAvatar({
    user,
    size = 'md',
}: {
    user: Pick<ChatUser, 'name' | 'avatar'> | null;
    size?: 'sm' | 'md' | 'lg';
}) {
    const getInitials = useInitials();
    const sizeClass =
        size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';

    return (
        <Avatar
            className={`${sizeClass} overflow-hidden rounded-full ring-1 ring-[rgba(34,197,94,0.4)]`}
        >
            <AvatarImage
                src={user?.avatar ?? undefined}
                alt={user?.name ?? ''}
            />
            <AvatarFallback className="bg-[rgba(34,197,94,0.15)] text-xs font-semibold text-able-green">
                {user ? getInitials(user.name) : '?'}
            </AvatarFallback>
        </Avatar>
    );
}
