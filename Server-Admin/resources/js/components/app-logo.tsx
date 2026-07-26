import type { SVGAttributes } from 'react';

export default function AppLogo(props: SVGAttributes<SVGElement>) {
    return (
        <div className="grid flex-1 text-center text-sm">
            <span className="relative mb-0.5 truncate leading-tight font-semibold" style={{ fontFamily: "'Unbounded', sans-serif", fontSize: '40px', letterSpacing: '4px' }}>
                ABL<span className="text-able-green">E</span>
                <span className="absolute text-[8px] text-muted-foreground font-normal" style={{ fontFamily: "'Archivo', sans-serif", top: '-2px', right: '50px' }}>v0.0.1</span>
            </span>
            <span className="truncate text-[12px] text-muted-foreground leading-tight" style={{ marginTop: '-8px' }}>
                Adaptive Browser-Level Extension
            </span>
        </div>
    );
}
