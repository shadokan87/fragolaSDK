import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageMarkdownUrl, gitConfig } from '@/lib/shared';
import { ScrollSpy } from './ScrollSpy';
import { CustomFooter } from './CustomFooter';
import { findNeighbour } from 'fumadocs-core/page-tree';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const tree = source.getPageTree();
  
  let groups: any[][] = [];
  let currentGroup: any[] = [];
  for (const node of tree.children) {
    if (node.type === 'separator') {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [];
    } else if (node.type === 'page') {
      currentGroup.push(node);
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const activeGroupNodes = groups.find(g => g.some(p => p.url === page.url)) || [];
  
  // Resolve actual pages
  const allPages = source.getPages();
  const sectionPages = activeGroupNodes
    .map(node => allPages.find(p => p.url === node.url))
    .filter(Boolean);

  if (sectionPages.length === 0) {
    sectionPages.push(page);
  }

  // Find next section's first page for the footer
  const lastPageInSection = sectionPages[sectionPages.length - 1];
  const neighbour = findNeighbour(tree, lastPageInSection.url);
  const nextSectionUrl = neighbour.next?.url;
  const nextSectionPage = nextSectionUrl ? allPages.find(p => p.url === nextSectionUrl) : null;
  
  const neighbourStart = findNeighbour(tree, sectionPages[0].url);
  const prevSectionUrl = neighbourStart.previous?.url;
  const prevSectionPage = prevSectionUrl ? allPages.find(p => p.url === prevSectionUrl) : null;

  // Combine TOCs
  const combinedToc = sectionPages.flatMap(p => p.data.toc);

  return (
    <DocsPage 
      toc={combinedToc} 
      full={page.data.full}
      footer={{ enabled: false }} // Disable Fumadocs automatic footer
    >
      <ScrollSpy />
      {sectionPages.map((p, idx) => {
        const MDX = p.data.body as any;
        const markdownUrl = getPageMarkdownUrl(p).url;
        
        return (
          <div key={p.url} data-url={p.url} className="section-page pb-24 border-b last:border-b-0 mb-12 pt-12 mt-[-3rem]">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b pb-6 mb-6 gap-4">
              <div className="flex-1 min-w-0">
                <DocsTitle>{p.data.title}</DocsTitle>
                <DocsDescription className="mb-0">{p.data.description}</DocsDescription>
              </div>
              <div className="flex flex-row gap-2 items-center self-start sm:self-auto shrink-0 mt-2 sm:mt-0 sm:mb-1">
                <MarkdownCopyButton markdownUrl={markdownUrl} />
                <ViewOptionsPopover
                  markdownUrl={markdownUrl}
                  githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${p.file?.path || p.slugs.join('/') + '.mdx'}`}
                />
              </div>
            </div>
            <DocsBody>
              <MDX
                components={getMDXComponents({
                  a: createRelativeLink(source, p),
                })}
              />
            </DocsBody>
          </div>
        );
      })}
      
      {/* Append our static footer that spans sections only */}
      <CustomFooter 
        previous={prevSectionPage ? { name: prevSectionPage.data.title, url: prevSectionPage.url } : null}
        next={nextSectionPage ? { name: nextSectionPage.data.title, url: nextSectionPage.url } : null}
      />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}
