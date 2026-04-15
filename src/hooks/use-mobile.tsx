import * as React from "react"

const MOBILE_BREAKPOINT = 768

// iPhone (and iPod touch) must always use the stacked mobile layout regardless
// of orientation: iPhone Pro Max landscape is 932px, which would otherwise fall
// into the desktop (split) layout and produce two unusably-narrow panes with
// no way to return to a sensible vertical view. iPad keeps the responsive
// breakpoint behavior — when wide enough, it gets the split layout.
// Note: iPad on iOS 13+ reports the user agent as "Macintosh", but iPhone
// never does, so this UA check is reliable for iPhone-only detection.
function isIPhoneClass(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPod/.test(navigator.userAgent)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const check = () => {
      if (isIPhoneClass()) {
        setIsMobile(true)
        return
      }
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", check)
    check()
    return () => mql.removeEventListener("change", check)
  }, [])

  return !!isMobile
}
