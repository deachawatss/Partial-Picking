import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-2xl border border-sand bg-white px-4 text-base text-coffee shadow-insetSoft transition-all placeholder:text-mocha/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:border-caramel disabled:cursor-not-allowed disabled:opacity-50 md:text-base',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
