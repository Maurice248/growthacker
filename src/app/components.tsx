"use client";

import React from 'react';

interface BadgeProps {
  text: any;
  color?: string;
  bg?: string;
}

export function Badge({ text, color, bg }: BadgeProps) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        background: bg,
        color,
        display: "inline-block",
        whiteSpace: "nowrap",
        letterSpacing: "0.03em",
        border: `1px solid ${color}25`,
      }}
    >
      {text}
    </span>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function Card({ children, style = {}, className = "" }: CardProps) {
  return (
    <div
      className={`animate-slide-up ${className}`}
      style={{
        background: "transparent",
        border: "none",
        borderRadius: 0,
        padding: 0,
        boxShadow: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface MetricCardProps {
  label: any;
  value: any;
  sub?: any;
  color?: string;
  bg?: string;
  dot?: boolean;
  icon?: any;
}

export function MetricCard({ label, value, sub, color, bg, dot, icon }: MetricCardProps) {
  void color;
  void bg;
  void dot;
  void icon;
  return (
    <div
      className="animate-scale-in editorial-metric-cell"
      style={{
        padding: "24px 24px 24px 0",
        borderRight: "1px solid var(--border)",
        position: "relative",
      }}
    >
      <div style={{
        fontSize: 12, letterSpacing: "1px", textTransform: "uppercase",
        color: "var(--text-muted)", marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700,
        color: "var(--primary)", lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>{sub}</div>
      )}
    </div>
  );
}

interface SectionTitleProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  action?: any;
}

export function SectionTitle({ children, style = {}, action }: SectionTitleProps) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline",
      justifyContent: action ? "space-between" : "flex-start",
      paddingBottom: 14,
      borderBottom: "1px solid var(--primary)",
      marginBottom: 0,
      ...style,
    }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: "var(--red)",
        textTransform: "uppercase", letterSpacing: "1.6px",
        fontFamily: "var(--font-display)",
      }}>
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface WorkflowStepProps {
  step: any;
  label: any;
  sub?: any;
  active?: boolean;
  done?: boolean;
}

export function WorkflowStep({ step, label, sub, active, done }: WorkflowStepProps) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      marginBottom: 16, transition: "opacity 0.2s",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        background: done ? "var(--green-light)" : active ? "var(--primary-light)" : "var(--surface)",
        border: `1.5px solid ${done ? "var(--green)" : active ? "var(--primary)" : "var(--border)"}`,
        fontSize: 12, fontWeight: 800,
        color: done ? "var(--green)" : active ? "var(--primary)" : "var(--text-dim)",
        transition: "all 0.3s ease",
      }}>
        {done ? "✓" : step}
      </div>
      <div style={{ paddingTop: 4 }}>
        <div style={{
          fontSize: 14, fontWeight: active || done ? 700 : 500,
          color: active || done ? "var(--text)" : "var(--text-dim)",
          transition: "color 0.2s",
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: 12, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.5,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: any;
  sub: any;
  icon?: any;
}

export function EmptyState({ title, sub, icon }: EmptyStateProps) {
  return (
    <div className="animate-fade-in" style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "var(--radius-lg)",
        background: "var(--surface)", border: "1px solid var(--border)",
        margin: "0 auto 16px", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 22, opacity: 0.65,
      }}>
        {icon || "📄"}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6,
        maxWidth: 300, margin: "0 auto",
      }}>
        {sub}
      </div>
    </div>
  );
}

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = "var(--primary)" }: SpinnerProps) {
  return (
    <div
      className="animate-spin"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}20`,
        borderTopColor: color,
        borderRadius: "50%",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  size?: "sm" | "md";
}

export function PrimaryButton({ children, onClick, disabled, style = {}, size = "md" }: PrimaryButtonProps) {
  const pad = size === "sm" ? "9px 16px" : "13px 20px";
  const fs  = size === "sm" ? 13 : 14;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: disabled ? "var(--border)" : "var(--primary)",
        color: disabled ? "var(--text-muted)" : "#FDF0D5",
        border: "none",
        borderRadius: "var(--radius-pill)",
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all 0.18s ease",
        letterSpacing: "0.01em",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--red)";
          e.currentTarget.style.boxShadow = "0 6px 16px -4px rgba(193,18,31,0.35)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--primary)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      {children}
    </button>
  );
}

interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  size?: "sm" | "md";
}

export function SecondaryButton({ children, onClick, style = {}, size = "md" }: SecondaryButtonProps) {
  const pad = size === "sm" ? "8px 14px" : "12px 18px";
  const fs  = size === "sm" ? 12 : 13;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "var(--card-bg)",
        border: "1.5px solid var(--primary)",
        borderRadius: "var(--radius-pill)",
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        color: "var(--text-muted)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s ease",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--primary)";
        e.currentTarget.style.color = "var(--primary)";
        e.currentTarget.style.background = "var(--primary-light)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-muted)";
        e.currentTarget.style.background = "var(--card-bg)";
      }}
    >
      {children}
    </button>
  );
}

/* ── Editorial layout (v4 design system) ── */

interface EditorialPageProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  wide?: boolean;
}

export function EditorialPage({ children, style = {}, wide }: EditorialPageProps) {
  return (
    <div
      className="editorial-page animate-fade-in"
      style={{ width: "100%", maxWidth: wide ? 1080 : 980, margin: "0 auto", paddingBottom: 96, boxSizing: "border-box", ...style }}
    >
      {children}
    </div>
  );
}

interface EditorialPageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

export function EditorialPageHeader({ eyebrow, title, subtitle, actions, style = {} }: EditorialPageHeaderProps) {
  return (
    <header style={{ marginBottom: 48, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontSize: 11.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
              {eyebrow}
            </div>
          )}
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: "-0.8px", color: "var(--text)", lineHeight: 1.1 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: "8px 0 0", color: "#4A5A64", fontSize: 15, lineHeight: 1.5 }}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 24, alignItems: "baseline", flexWrap: "wrap" }}>{actions}</div>
        )}
      </div>
    </header>
  );
}

interface EditorialSectionHeaderProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  style?: React.CSSProperties;
}

export function EditorialSectionHeader({ title, meta, style = {} }: EditorialSectionHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid var(--primary)", marginBottom: 0, ...style }}>
      <div style={{ fontSize: 11.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--red)", fontWeight: 700, fontFamily: "var(--font-display)" }}>
        {title}
      </div>
      {meta && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{meta}</div>}
    </div>
  );
}

interface EditorialStatRibbonProps {
  children: React.ReactNode;
  columns?: number;
}

export function EditorialStatRibbon({ children, columns = 4 }: EditorialStatRibbonProps) {
  return (
    <section
      className="editorial-stat-ribbon"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        borderTop: "1px solid var(--primary)",
      }}
    >
      {children}
    </section>
  );
}

interface EditorialStatCellProps {
  value: React.ReactNode;
  label: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "default" | "danger" | "muted";
  isFirst?: boolean;
  isLast?: boolean;
}

export function EditorialStatCell({ value, label, sub, accent = "default", isFirst, isLast }: EditorialStatCellProps) {
  const valueColor = accent === "danger" ? "var(--red)" : accent === "muted" ? "var(--text-muted)" : "var(--primary)";
  const labelColor = accent === "danger" ? "var(--red)" : "var(--text-muted)";
  return (
    <div
      style={{
        padding: isFirst ? "24px 24px 24px 0" : isLast ? "24px 0 24px 24px" : "24px",
        borderRight: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: labelColor, marginTop: 10 }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: "#4A5A64", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

interface EditorialPanelStatCellProps {
  label: React.ReactNode;
  value: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
}

/** Account-health style stat: label above value at 30px (v4 Meta Ads Overview). */
export function EditorialPanelStatCell({ label, value, isFirst, isLast }: EditorialPanelStatCellProps) {
  return (
    <div
      style={{
        padding: isFirst ? "24px 24px 24px 0" : isLast ? "24px 0 24px 24px" : "24px",
        borderRight: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--primary)", marginTop: 8, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

interface EditorialMetricItemProps {
  label: React.ReactNode;
  value: React.ReactNode;
  accent?: "default" | "danger";
  size?: "md" | "sm";
}

export function EditorialMetricItem({ label, value, accent = "default", size = "md" }: EditorialMetricItemProps) {
  const valueColor = accent === "danger" ? "var(--red)" : "var(--primary)";
  const valueSize = size === "sm" ? 15 : 19;
  const labelSize = size === "sm" ? 11.5 : 12;
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: labelSize, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: valueSize, fontWeight: 700, color: valueColor, marginTop: size === "sm" ? 3 : 4 }}>{value}</div>
    </div>
  );
}

interface EditorialDefinitionListProps {
  children: React.ReactNode;
}

export function EditorialDefinitionList({ children }: EditorialDefinitionListProps) {
  return <div>{children}</div>;
}

interface EditorialDefinitionRowProps {
  label: React.ReactNode;
  labelSub?: React.ReactNode;
  children: React.ReactNode;
  isLast?: boolean;
}

export function EditorialDefinitionRow({ label, labelSub, children, isLast }: EditorialDefinitionRowProps) {
  return (
    <div
      className="editorial-definition-row"
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: "0 40px",
        padding: "26px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        alignItems: labelSub ? "start" : "center",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
        {label}
        {labelSub && (
          <span style={{ display: "block", fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {labelSub}
          </span>
        )}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

interface EditorialPillButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "outline" | "ghost";
  style?: React.CSSProperties;
}

export function EditorialPillButton({ children, onClick, disabled, variant = "primary", style = {} }: EditorialPillButtonProps) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: 14,
    padding: variant === "ghost" ? "0" : "10px 22px",
    borderRadius: variant === "ghost" ? 0 : 999,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    border: "none",
    background: "transparent",
    transition: "background 0.15s ease, color 0.15s ease, opacity 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
  if (variant === "primary") {
    base.background = "var(--primary)";
    base.color = "#FDF0D5";
  } else if (variant === "danger") {
    base.background = "#C1121F";
    base.color = "#FDF6E3";
  } else if (variant === "outline") {
    base.background = "transparent";
    base.color = "var(--primary)";
    base.border = "1px solid var(--primary)";
    base.padding = "9px 24px";
  } else {
    base.color = "#4A5A64";
  }
  Object.assign(base, style);

  const className =
    variant === "primary"
      ? "editorial-pill-btn-primary"
      : variant === "danger"
        ? "editorial-pill-btn-danger"
        : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={base}
    >
      {children}
    </button>
  );
}

interface EditorialTextLinkProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function EditorialTextLink({ children, onClick, disabled, style = {} }: EditorialTextLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: 700,
        color: "#4A5A64",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface EditorialFieldProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "password" | "email" | "url";
  style?: React.CSSProperties;
}

export function EditorialField({ value, onChange, disabled, placeholder, multiline, rows = 3, type = "text", style = {} }: EditorialFieldProps) {
  const shared: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--font-sans)",
    fontSize: 15,
    lineHeight: 1.6,
    padding: "10px 0",
    border: "none",
    borderBottom: disabled ? "none" : "1px solid #C2B79A",
    background: "transparent",
    color: disabled ? "#4A5A64" : "var(--primary)",
    outline: "none",
    resize: multiline ? "vertical" : "none",
    boxShadow: "none",
    ...style,
  };
  if (disabled) {
    return <p style={{ margin: 0, ...shared, whiteSpace: "pre-wrap" }}>{value || "—"}</p>;
  }
  if (multiline) {
    return <textarea className="editorial-field" value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} rows={rows} style={shared} />;
  }
  return <input type={type} className="editorial-field" value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} style={shared} />;
}

interface EditorialTabItem {
  id: string;
  label: React.ReactNode;
  count?: number;
}

interface EditorialTabBarProps {
  tabs: EditorialTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  style?: React.CSSProperties;
}

export function EditorialTabBar({ tabs, activeId, onChange, style = {} }: EditorialTabBarProps) {
  return (
    <div
      className="editorial-tab-bar"
      style={{
        display: "flex",
        gap: 28,
        borderBottom: "1px solid var(--primary)",
        marginBottom: 8,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? "var(--red)" : "#4A5A64",
              padding: "0 2px 12px",
              marginBottom: -1,
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid var(--red)" : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s ease",
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span style={{ color: "#8C8474" }}> · {tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface EditorialStatusPillProps {
  children: React.ReactNode;
  variant?: "approved" | "unapproved" | "active" | "neutral" | "danger";
}

export function EditorialStatusPill({ children, variant = "neutral" }: EditorialStatusPillProps) {
  const styles: Record<string, React.CSSProperties> = {
    approved: { color: "#38678A", border: "1px solid #7FA6BC" },
    active: { color: "#38678A", border: "1px solid #7FA6BC" },
    unapproved: { color: "#B0700A", border: "1px solid #E0B75C" },
    danger: { color: "#C1121F", border: "1px solid #E0A8A8" },
    neutral: { color: "#8C8474", border: "1px solid #C2B79A" },
  };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "1px",
        textTransform: "uppercase",
        borderRadius: 999,
        padding: "3px 10px",
        whiteSpace: "nowrap",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

interface EditorialListRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function EditorialListRow({ children, onClick, style = {} }: EditorialListRowProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        borderTop: "1px solid var(--border)",
        padding: "18px 0",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
