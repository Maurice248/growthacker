type AdminPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
};

export function AdminPageHeader({ title, description, eyebrow = 'Platform admin' }: AdminPageHeaderProps) {
  return (
    <header className="border-b border-zinc-200/80 pb-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700/90">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>}
    </header>
  );
}
