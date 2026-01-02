---
name: design
description: Provides design system guidance, UI/UX best practices, and component design for IdiamPro. Use when creating UI components, discussing layouts, accessibility, responsive design, or maintaining visual consistency across the app.
---

# IdiamPro Design Skill

## Design System Overview

IdiamPro uses a consistent design system built on:
- **Tailwind CSS** for utility-first styling
- **Radix UI** for accessible, unstyled primitives
- **shadcn/ui** component patterns
- **Lucide React** for icons

## Color System

Use CSS variables for theming (supports light/dark mode):

```css
/* Primary colors */
--primary: hsl(...)
--primary-foreground: hsl(...)

/* Semantic colors */
--background: hsl(...)
--foreground: hsl(...)
--muted: hsl(...)
--muted-foreground: hsl(...)
--accent: hsl(...)
--destructive: hsl(...)

/* Component colors */
--card: hsl(...)
--popover: hsl(...)
--border: hsl(...)
```

## Typography

- **Headlines**: `font-headline` class (defined in Tailwind config)
- **Body text**: `font-body` class
- **Code/monospace**: `font-mono`

Text sizes follow Tailwind's scale: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`

## Spacing

Use Tailwind's spacing scale consistently:
- `p-2`, `p-4`, `p-6` for padding
- `gap-2`, `gap-4` for flex/grid gaps
- `space-y-4` for vertical rhythm

## Component Patterns

### Buttons
```tsx
<Button variant="default|outline|ghost|destructive" size="default|sm|lg|icon">
```

### Cards
```tsx
<Card>
  <CardHeader>
    <CardTitle>...</CardTitle>
    <CardDescription>...</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### Dialogs
```tsx
<Dialog>
  <DialogTrigger>...</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    {/* content */}
    <DialogFooter>...</DialogFooter>
  </DialogContent>
</Dialog>
```

### Context Menus
```tsx
<ContextMenu>
  <ContextMenuTrigger>...</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>...</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuSub>
      <ContextMenuSubTrigger>...</ContextMenuSubTrigger>
      <ContextMenuSubContent>...</ContextMenuSubContent>
    </ContextMenuSub>
  </ContextMenuContent>
</ContextMenu>
```

## Icons

Use Lucide React icons consistently:
```tsx
import { Plus, Trash, Edit, ChevronRight } from 'lucide-react';

// Standard sizes
<Icon className="h-4 w-4" />  // Small (in buttons, menus)
<Icon className="h-5 w-5" />  // Default
<Icon className="h-6 w-6" />  // Large
```

## Responsive Design

IdiamPro runs on:
- **Desktop browsers** (primary)
- **Mac Electron app**
- **iOS/iPad** (via Capacitor)

### Breakpoints
- Mobile-first approach
- `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)

### Touch Targets
For iOS compatibility, ensure touch targets are at least 44x44px:
```tsx
className="min-w-[44px] min-h-[44px] touch-manipulation"
```

### Safe Areas
Account for iOS notch and home indicator:
```tsx
style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
```

## Accessibility Guidelines

1. **Keyboard Navigation**: All interactive elements must be keyboard accessible
2. **Focus Indicators**: Use `focus:ring-2 focus:ring-primary` or similar
3. **ARIA Labels**: Provide labels for icon-only buttons
4. **Color Contrast**: Maintain WCAG AA contrast ratios
5. **Screen Readers**: Use semantic HTML and ARIA attributes

```tsx
// Icon-only button with accessible label
<Button variant="ghost" size="icon" aria-label="Delete item">
  <Trash className="h-4 w-4" />
</Button>
```

## Layout Patterns

### Two-Pane Layout (Outline + Content)
```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={30} minSize={20}>
    {/* Outline pane */}
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={70}>
    {/* Content pane */}
  </ResizablePanel>
</ResizablePanelGroup>
```

### Mobile Layout
On mobile, show single pane with back navigation:
```tsx
{onBack && (
  <Button variant="ghost" size="icon" onClick={onBack}>
    <ArrowLeft />
  </Button>
)}
```

## Animation & Transitions

Use subtle animations for better UX:
```tsx
// Hover transitions
className="transition-colors hover:bg-accent"

// Expand/collapse
className="transition-all duration-200"

// Loading states
<Loader2 className="h-4 w-4 animate-spin" />
```

## Dark Mode

All colors use CSS variables that automatically adapt to dark mode.
Use semantic color classes:
- `bg-background` not `bg-white`
- `text-foreground` not `text-black`
- `border-border` not `border-gray-200`

## Best Practices

1. **Consistency**: Reuse existing components from `src/components/ui/`
2. **Composition**: Build complex UI from simple primitives
3. **Responsiveness**: Test on desktop and mobile viewports
4. **Performance**: Use `queueMicrotask()` for deferred updates
5. **Platform awareness**: Use `isCapacitor()` for iOS-specific UI adjustments
