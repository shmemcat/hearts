/** Public files and share links live beneath the game, with separate game API and socket prefixes. */
export const gamePath = (path: string): string =>
   `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
