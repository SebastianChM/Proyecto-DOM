"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps {
    value?: number
    className?: string
}

export function Progress({ value, className }: ProgressProps) {
    const isIndeterminate = value === undefined || value === null

    return (
        <div
            className={cn(
                "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
                className
            )}
        >
            <div
                className={cn(
                    "h-full bg-primary transition-all",
                    isIndeterminate ? "animate-progress-indeterminate w-1/3" : "",
                    !isIndeterminate && value !== undefined && value >= 100 && "w-full",
                    !isIndeterminate && value !== undefined && value >= 75 && value < 100 && "w-3/4",
                    !isIndeterminate && value !== undefined && value >= 50 && value < 75 && "w-1/2",
                    !isIndeterminate && value !== undefined && value >= 25 && value < 50 && "w-1/4",
                    !isIndeterminate && value !== undefined && value > 0 && value < 25 && "w-[10%]"
                )}
            />
        </div>
    )
}
