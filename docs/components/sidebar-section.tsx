import type * as PageTree from 'fumadocs-core/page-tree';

export function SidebarSection({ item }: { item: PageTree.Separator }) {
  return (
    <div className="docs-sidebar-section">
      <p className="docs-sidebar-section__label">
        {item.icon ? <span className="docs-sidebar-section__icon">{item.icon}</span> : null}
        <span>{item.name}</span>
      </p>
    </div>
  );
}