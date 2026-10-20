import { usePage } from '@inertiajs/react';

export default function AppLogo() {
    const { extension_version } = usePage().props;

    return (
        <div className="grid flex-1 text-center text-sm select-none">
            <span
                className="relative mb-0.5 truncate leading-tight font-semibold text-foreground"
                style={{
                    fontFamily: "'Unbounded', sans-serif",
                    fontSize: '40px',
                    letterSpacing: '4px',
                }}
            >
                ABL<span className="text-able-green">E</span>
                {extension_version && (
                    <span
                        className="absolute text-[8px] font-normal text-white"
                        style={{
                            fontFamily: "'Archivo', sans-serif",
                            top: '-2px',
                            right: '50px',
                        }}
                    >
                        v{extension_version}
                    </span>
                )}
            </span>
            <span
                className="truncate text-[12px] leading-tight text-muted-foreground"
                style={{
                    marginTop: '-8px',
                    fontFamily: "'Archivo', sans-serif",
                }}
            >
                Adaptive Browser-Level Extension
            </span>
        </div>
    );
}
