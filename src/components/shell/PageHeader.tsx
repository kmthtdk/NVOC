// PageHeader — the display-type heading each page opens with.
//
// The reference gives every screen a large heading in the display face with a
// one-line subtitle beneath it, and nothing else on that row except the page's
// own primary action. It only became possible once navigation moved out of the
// content column and into the rail: the tab bar used to occupy exactly this
// space.

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-[32px] font-bold leading-tight tracking-tight text-slate-900 lg:text-[40px] dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
