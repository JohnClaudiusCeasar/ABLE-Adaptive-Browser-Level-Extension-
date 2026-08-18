export default function AppLogo() {
    return (
        <div className="grid flex-1 text-center text-sm">
            <span
                className="relative mb-0.5 truncate leading-tight font-semibold"
                style={{
                    fontFamily: "'Unbounded', sans-serif",
                    fontSize: '40px',
                    letterSpacing: '4px',
                }}
            >
                ABL<span className="text-able-green">E</span>
                <span
                    className="absolute text-[8px] font-normal text-muted-foreground"
                    style={{
                        fontFamily: "'Archivo', sans-serif",
                        top: '-2px',
                        right: '50px',
                    }}
                >
                    v0.0.1
                </span>
            </span>
            <span
                className="truncate text-[12px] leading-tight text-muted-foreground"
                style={{ marginTop: '-8px' }}
            >
                Adaptive Browser-Level Extension
            </span>
        </div>
    );
}
