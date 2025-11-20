import React, { RefObject } from 'react';

type JustifyType = 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';

interface FlexProps {
    children: React.ReactNode;
    col?: boolean;
    gap?: number;
    justify?: JustifyType;
    className?: string;
    ref?: RefObject<HTMLDivElement>;
}

const Flex = React.forwardRef<HTMLDivElement, Omit<FlexProps, 'ref'>>(
    ({ children, col = false, gap = undefined, justify = undefined, className = '' }, ref) => {
        const direction = col ? 'flex-col' : 'flex-row';
        const gapClass = gap ? `gap-${gap}` : '';
        const justifyClass = justify ? `justify-${justify}` : '';
        const classes = ['flex', direction, gapClass, justifyClass, className].filter(Boolean).join(' ');

        return (
            <div ref={ref} className={classes}>
                {children}
            </div>
        );
    }
);

export default Flex;