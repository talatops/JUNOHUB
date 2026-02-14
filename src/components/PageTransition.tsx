"use client"

import { motion } from "framer-motion"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageTransitionProps {
    children: ReactNode
    className?: string
}

export default function PageTransition({ children, className }: PageTransitionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
                duration: 0.2,
                ease: [0.4, 0, 0.2, 1]
            }}
            style={{
                willChange: 'opacity, transform',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)'
            }}
            className={cn("flex-1 flex flex-col min-h-0", className)}
        >
            {children}
        </motion.div>
    )
}
