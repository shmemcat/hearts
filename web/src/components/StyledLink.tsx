import { Link } from "react-router-dom";

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
}) => {
   const cls = `link ${className}`.trim();
   if (href.startsWith("http")) {
      return (
         <a href={href} className={cls} {...rest}>
            {children}
         </a>
      );
   }
   return (
      <Link to={href} className={cls} {...rest}>
         {children}
      </Link>
   );
};
