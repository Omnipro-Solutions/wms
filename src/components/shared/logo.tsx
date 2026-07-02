import type { SVGProps } from 'react'

export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" {...props}>
    <path
      fillRule="evenodd"
      d="M50 4a46 46 0 1 1 0 92 46 46 0 0 1 0-92m0 24a22 22 0 1 0 0 44 22 22 0 0 0 0-44"
    />
  </svg>
)
