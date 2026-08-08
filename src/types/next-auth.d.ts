import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      username?: string | null;
      isTeacher?: boolean;
    };
  }

  interface User {
    username?: string;
    isTeacher?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    isTeacher?: boolean;
  }
}
