type AccountPageProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AccountPage({ title, description, children }: AccountPageProps) {
  return (
    <div className="contents">
      <header className="order-1 space-y-1 lg:col-start-2 lg:row-start-1">
        <h1 className="text-2xl font-bold text-[var(--text)]">{title}</h1>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </header>
      <div className="order-3 min-w-0 space-y-6 lg:col-start-2 lg:row-start-2">{children}</div>
    </div>
  );
}
