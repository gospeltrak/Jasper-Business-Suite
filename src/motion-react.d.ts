import type { ComponentType, PropsWithChildren } from 'react';
import 'motion/react';

declare module 'motion/react' {
  export const AnimatePresence: ComponentType<PropsWithChildren<{
    initial?: boolean;
    mode?: 'sync' | 'wait' | 'popLayout';
    onExitComplete?: () => void;
  }>>;
}
