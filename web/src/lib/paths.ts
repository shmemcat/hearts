/** Public files and share links live beneath the game, while /api stays shared. */
export const gamePath = (path: string): string =>
   `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
