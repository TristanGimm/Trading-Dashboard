import type { ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants=cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50',{variants:{variant:{default:'bg-violet-500 text-white hover:bg-violet-400',ghost:'text-slate-300 hover:bg-white/10',outline:'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'},size:{default:'h-10 px-4',sm:'h-9 px-3'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>&{asChild?:boolean}){const C=asChild?Slot:'button';return <C className={cn(variants({variant,size}),className)} {...props}/>}
