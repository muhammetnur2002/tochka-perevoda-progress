import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/** Обёртка секции с заголовком. */
export function Section({ title, subtitle, children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn("py-14 md:py-20", className)}>
      <div className="container">
        {(title || subtitle) && (
          <div className="mb-10 max-w-2xl">
            {title && (
              <h2 className="text-balance text-2xl font-bold tracking-tight text-brand-900 md:text-3xl">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
