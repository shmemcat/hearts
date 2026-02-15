import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
  }

  interface Session {
    user: User;
  }
}
