declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "@/styles/colors.module.css" {
  const classes: { [key: string]: string };
  export default classes;
  export const rulesbuttonselected: string;
  export const tan: string;
  export const heartslogo: string;
  export const sparkle: string;
}
