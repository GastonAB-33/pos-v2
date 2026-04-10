import type { ReactNode } from "react";

interface PagePlaceholderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const PagePlaceholder = ({ title, description, children }: PagePlaceholderProps) => {
  return (
    <section className="ui-panel">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </header>
      {children}
    </section>
  );
};
