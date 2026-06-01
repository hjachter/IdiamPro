"use client"

import React from "react"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function renderNodeToString(node: React.ReactNode): string {
  if (node === null || node === undefined || node === false || node === true) {
    return ""
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(renderNodeToString).join("")
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    return renderNodeToString(props.children)
  }
  return ""
}

export function Toaster() {
  const { toasts } = useToast()
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [iconCopiedId, setIconCopiedId] = React.useState<string | null>(null)

  const handleCopy = (id: string, title: React.ReactNode, description: React.ReactNode) => {
    const text = [title, description].filter(Boolean).join(': ')
    navigator.clipboard.writeText(String(text))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleIconCopy = (
    id: string,
    title: React.ReactNode,
    description: React.ReactNode
  ) => {
    const titleStr = renderNodeToString(title).trim()
    const descStr = renderNodeToString(description).trim()
    const text = titleStr && descStr ? `${titleStr}: ${descStr}` : titleStr || descStr
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setIconCopiedId(id)
        setTimeout(() => setIconCopiedId((current) => (current === id ? null : current)), 1500)
      }).catch(() => {
        // Fail silently — copy is a convenience.
      })
    }
  }

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={300}>
        {toasts.map(function ({ id, title, description, action, variant, ...props }) {
          const isError = variant === "destructive"
          const justCopied = iconCopiedId === id
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Copy message"
                    onClick={() => handleIconCopy(id, title, description)}
                    className="absolute right-8 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600"
                  >
                    {justCopied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Copy</TooltipContent>
              </Tooltip>
              <ToastClose />
            </Toast>
          )
        })}
      </TooltipProvider>
      <ToastViewport />
    </ToastProvider>
  )
}
