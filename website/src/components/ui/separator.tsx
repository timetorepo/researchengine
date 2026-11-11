import { cn } from "@/lib/utils"

/**
 * Separator — the site's own stand-in for @shadcn-space/separator.
 *
 * The vendored shadcnspace primitive imports `@base-ui/react/separator`, and a
 * horizontal rule is not worth a component library on a static marketing page.
 * The app keeps the Base UI primitive (it is a real dependency there); this is
 * markup-compatible with the calls the vendored blocks make: `<Separator />`,
 * `<Separator className="…" />`.
 */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      data-slot="separator"
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
