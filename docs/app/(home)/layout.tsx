import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { UnderConstructionDialog } from './UnderConstructionDialog';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <DocsLayout tree={source.pageTree} {...baseOptions()}>
      {children}
      <UnderConstructionDialog />
    </DocsLayout>
  );
}
