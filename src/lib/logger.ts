type LogLevel = "debug" | "info" | "warn" | "error"

const isProd = process.env.NODE_ENV === "production"

function log(level: LogLevel, message: string, meta?: unknown) {
    const payload = meta !== undefined ? [message, meta] : [message]

    switch (level) {
        case "debug":
            if (!isProd) {
                 
                console.debug(...payload)
            }
            break
        case "info":
             
            console.info(...payload)
            break
        case "warn":
             
            console.warn(...payload)
            break
        case "error":
             
            console.error(...payload)
            break
    }
}

export const logger = {
    debug: (message: string, meta?: unknown) => log("debug", message, meta),
    info: (message: string, meta?: unknown) => log("info", message, meta),
    warn: (message: string, meta?: unknown) => log("warn", message, meta),
    error: (message: string, meta?: unknown) => log("error", message, meta),
}

