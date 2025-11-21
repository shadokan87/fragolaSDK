import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image src="/logo.png" alt="Fragola" width={54} height={54} />
          <span>Fragola SDK</span>
        </>
      ),
    },
  };
}