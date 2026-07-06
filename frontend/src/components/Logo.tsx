import { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="6" y="6" width="10" height="10" rx="2" className="fill-amber-500" />
      <rect x="24" y="24" width="10" height="10" rx="2" className="fill-amber-500" />
      <path d="M11 16V29C11 30.1 11.9 31 13 31H24" className="stroke-amber-500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="miter" />
      <circle cx="29" cy="11" r="5" className="fill-teal-500" />
      <path d="M16 11H24" className="stroke-zinc-500" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
    </svg>
  );
}
