import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot } from "@fortawesome/pro-solid-svg-icons";
import { getProfileIcon } from "@/lib/profileIcons";

const BOT_RE = /^Bot\s*\d+$/i;

export interface PlayerIconProps {
   name: string;
   icon?: string;
   size?: number;
   className?: string;
}

export const PlayerIcon: React.FC<PlayerIconProps> = ({
   name,
   icon,
   size,
   className,
}) => {
   const faIcon = BOT_RE.test(name) ? faRobot : getProfileIcon(icon);
   return (
      <FontAwesomeIcon
         icon={faIcon}
         className={className}
         style={size ? { fontSize: size } : undefined}
      />
   );
};
