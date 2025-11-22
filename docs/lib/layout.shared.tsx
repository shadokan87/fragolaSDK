import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src="/logos/logo_dark_theme.png"
            alt="Fragola"
            width={38}
            height={38}
            className="logo-image"
          />
          <span>FragolaAI Agentic SDK</span>
        </>
      ),
    },
  };
}