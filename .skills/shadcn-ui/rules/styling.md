# Styling & Customization

See [customization.md](../customization.md) for theming, CSS variables, and adding custom colors.

## Contents
- Semantic colors
- Built-in variants first
- className for layout only
- No space-x-* / space-y-*
- Prefer size-* over w-* h-* when equal
- Prefer truncate shorthand
- No manual dark: color overrides
- Use cn() for conditional classes
- No manual z-index on overlay components
- Use shimmer / scroll-fade utilities, not custom animations

---

## Semantic colors

**Incorrect:**
```tsx
<p className="text-gray-500">Secondary text</p>
```

**Correct:**
```tsx
<p className="text-muted-foreground">Secondary text</p>
```

---

## No raw color values for status/state indicators

For positive, negative, or status indicators, use Badge variants, semantic tokens like `text-destructive`, or define custom CSS variables — don't reach for raw Tailwind colors.

**Incorrect:**
```tsx
<Badge className="bg-green-500">+20.1%</Badge>
<Badge className="bg-blue-500">Active</Badge>
<Badge className="bg-red-500">-3.2%</Badge>
```

**Correct:**
```tsx
<Badge variant="success">+20.1%</Badge>
<Badge variant="default">Active</Badge>
<Badge variant="destructive">-3.2%</Badge>
```

If you need a success/positive color that doesn't exist as a semantic token, use a Badge variant or ask the user about adding a custom CSS variable to the theme (see [customization.md](../customization.md)).

---

## Built-in variants first

**Incorrect:**
```tsx
<Button className="bg-blue-600 hover:bg-blue-700">Click me</Button>
```

**Correct:**
```tsx
<Button variant="default">Click me</Button>
```

---

## className for layout only

Use `className` for layout (e.g. `max-w-md`, `mx-auto`, `mt-4`), **not** for overriding component colors or typography. To change colors, use semantic tokens, built-in variants, or CSS variables.

**Incorrect:**
```tsx
<div className="bg-white text-gray-900 dark:bg-gray-950 dark:text-white">Dashboard</div>
```

**Correct:**
```tsx
<div className="bg-background text-foreground">Dashboard</div>
```

To customize a component's appearance, prefer these approaches in order:
1. **Built-in variants** — `variant="outline"`, `variant="destructive"`, etc.
2. **Semantic color tokens** — `bg-primary`, `text-muted-foreground`.
3. **CSS variables** — define custom colors in the global CSS file (see [customization.md](../customization.md)).

---

## No space-x-* / space-y-*

Use `gap-*` instead. `space-y-4` → `flex flex-col gap-4`. `space-x-2` → `flex gap-2`.

```tsx
<div className="flex flex-col gap-4">
  <Button>Submit</Button>
</div>
```

---

## Prefer size-* over w-* h-* when equal

`size-10` not `w-10 h-10`. Applies to icons, avatars, skeletons, etc.

---

## Prefer truncate shorthand

`truncate` not `overflow-hidden text-ellipsis whitespace-nowrap`.

---

## No manual dark: color overrides

Use semantic tokens — they handle light/dark via CSS variables. `bg-background text-foreground` not `bg-white dark:bg-gray-950`.

---

## Use cn() for conditional classes

Use the `cn()` utility from the project for conditional or merged class names. Don't write manual ternaries in className strings.

**Incorrect:**
```tsx
<div className={`p-4 ${active ? "bg-primary" : "bg-muted"}`} />
```

**Correct:**
```tsx
import { cn } from "@/lib/utils"
<div className={cn("p-4", active ? "bg-primary" : "bg-muted")} />
```

---

## No manual z-index on overlay components

`Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard` handle their own stacking. Never add `z-50` or `z-[999]`.

---

## Use shimmer / scroll-fade utilities, not custom animations

For a live "thinking…" or loading-text shimmer, apply the `shimmer` utility. Don't author a custom `@keyframes` or a `bg-clip-text` gradient sweep. For scroll-aware edge fading on a scroll container, use `scroll-fade` (and the axis variants `scroll-fade-x` / `scroll-fade-b`). Don't hand-roll mask gradients. The chat components already apply these internally: `Attachment` shimmers its title during upload, and `MessageScrollerViewport` fades its edges.

**Incorrect:**
```tsx
<span className="animate-pulse bg-gradient-to-r from-muted via-muted-foreground/20 to-muted bg-clip-text text-transparent">Thinking…</span>
```

**Correct:**
```tsx
<span className="shimmer">Thinking…</span>
```
