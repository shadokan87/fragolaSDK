import Link from 'next/link';

export function CustomFooter({ previous, next }: { previous?: { name: string, url: string } | null, next?: { name: string, url: string } | null }) {
  return (
    <div className="flex flex-row items-center justify-between border-t py-6 mt-12 w-full">
      {previous ? (
        <Link href={previous.url} className="flex flex-col gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors text-left border rounded-lg p-4 hover:bg-muted/50 w-full max-w-[48%]">
          <span className="text-xs">Previous Section</span>
          <span className="font-medium text-base text-foreground">{previous.name}</span>
        </Link>
      ) : <div />}
      
      {next ? (
        <Link href={next.url} className="flex flex-col gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors text-right border rounded-lg p-4 hover:bg-muted/50 w-full max-w-[48%] ml-auto">
          <span className="text-xs">Next Section</span>
          <span className="font-medium text-base text-foreground">{next.name}</span>
        </Link>
      ) : <div />}
    </div>
  );
}
