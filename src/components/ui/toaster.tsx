"use client"

import React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const handleCopy = (id: string, title: React.ReactNode, description: React.ReactNode) => {
    const text = [title, description].filter(Boolean).join(': ')
    navigator.clipboard.writeText(String(text))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isError = variant === "destructive"
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {isError && (
                <button
                  onClick={() => handleCopy(id, title, description)}
                  className="mt-1 text-xs underline opacity-70 hover:opacity-100 text-left"
                >
                  {copiedId === id ? "Copied!" : "Copy error message"}
                </button>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
