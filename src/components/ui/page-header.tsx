import type { ReactNode } from "react";

/**
 * Page header (brand pass 2026-07-16): the h1 + optional description that
 * opens every signed-in page, with a slot for a small decorative SVG or
 * page-level actions. The experience role chip lives ONCE in the app
 * shell, never here.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {children}
      </div>
      {description ? (
        <p className="max-w-prose text-base leading-relaxed text-base-content/80">
          {description}
        </p>
      ) : null}
    </div>
  );
}
