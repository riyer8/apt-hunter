export default function CollapsibleSection({
  title,
  headline,
  preview,
  action,
  defaultOpen = false,
  className = "",
  bodyClassName = "",
  children,
}) {
  return (
    <section className={["collapsible-section", className].filter(Boolean).join(" ")}>
      <details open={defaultOpen}>
        <summary className="collapsible-section-summary">
          <div className="collapsible-section-summary-main">
            <h2>{title}</h2>
            <div className="collapsible-section-summary-meta">
              {action ? (
                <span className="collapsible-section-action" onClick={(event) => event.stopPropagation()}>
                  {action}
                </span>
              ) : null}
              <span className="collapsible-section-chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          </div>
          {headline ? <p className="collapsible-section-stats">{headline}</p> : null}
          {preview ? <p className="collapsible-section-preview">{preview}</p> : null}
        </summary>
        <div className={["collapsible-section-body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
      </details>
    </section>
  );
}
