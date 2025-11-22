import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <span className="logo-container">
            <Image
              src="/logos/logo_light_theme.png"
              alt="Fragola"
              width={38}
              height={38}
              className="logo-light"
            />
            <Image
              src="/logos/logo_dark_theme.png"
              alt="Fragola"
              width={38}
              height={38}
              className="logo-dark"
            />
          </span>
          <span>FragolaAI Agentic SDK</span>
        </>
      ),
    },
  };
}