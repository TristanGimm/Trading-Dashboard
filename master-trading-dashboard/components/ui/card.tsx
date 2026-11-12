import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
export function Card({className, ...props}: HTMLAttributes<HTMLDivElement>) {return <div className={cn('surface rounded-[20px] border border-white/[.07] shadow-[0_12px_40px_rgba(0,0,0,.10)]',className)} {...props}/>;}
