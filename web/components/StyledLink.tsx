import Link from "next/link";

interface StyledLinkProps
   extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
   href: string;
   children: React.ReactNode;
   className?: string;
}

export const StyledLink: React.FC<StyledLinkProps> = ({
   href,
   children,
   className = "",
   ...rest
}) => (
   <Link href={href} className={`link ${className}`.trim()} {...rest}>
      {children}
   </Link>
);
