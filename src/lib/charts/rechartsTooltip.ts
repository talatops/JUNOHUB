import type { CSSProperties } from "react"

export type RechartsTooltipChrome = {
    contentStyle: CSSProperties
    labelStyle: CSSProperties
    itemStyle: CSSProperties
    wrapperStyle: CSSProperties
}

/**
 * Theme-aware defaults for Recharts <Tooltip />. Recharts often ignores `color` on
 * `contentStyle` for label/value rows — labelStyle + itemStyle keep dark mode readable.
 */
export function chartTooltipProps(isLight: boolean): RechartsTooltipChrome {
    const fg = isLight ? "#0f172a" : "#f8fafc"
    return {
        contentStyle: {
            borderRadius: 12,
            border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.16)",
            background: isLight ? "#ffffff" : "#334155",
            color: fg,
            fontWeight: 700,
            boxShadow: isLight
                ? "0 10px 15px -3px rgba(15, 23, 42, 0.08)"
                : "0 14px 28px rgba(0, 0, 0, 0.55)",
        },
        labelStyle: { color: fg, fontWeight: 700 },
        itemStyle: { color: fg },
        wrapperStyle: { outline: "none", zIndex: 50 },
    }
}
