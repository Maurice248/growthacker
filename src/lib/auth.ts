import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/** Session user id; null when unauthenticated. */
export async function getRequestUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/** Session user email; null when unauthenticated. */
export async function getRequestUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

/** Session company id (effective — includes admin impersonation); null when unauthenticated or no company. */
export async function getRequestCompanyId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.companyId ?? null;
}

export type RequestUser = {
  id: string;
  companyId: string | null;
  role: string;
};

/** Session user context; null when unauthenticated. */
export async function getRequestUser(): Promise<RequestUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    companyId: session.user.companyId ?? null,
    role: session.user.role,
  };
}

export const APP_ADMIN_ROLE = 'APP_ADMIN';
export const COMPANY_ADMIN_ROLE = 'COMPANY_ADMIN';
export const COMPANY_MEMBER_ROLE = 'COMPANY_MEMBER';
/** @deprecated Legacy member role — normalized to COMPANY_MEMBER */
export const LEGACY_CLIENT_ROLE = 'CLIENT';
/** Legacy platform seed role — treated as company admin for backward compatibility. */
export const LEGACY_ADMIN_ROLE = 'ADMIN';

export function isAppAdminRole(role: string | undefined | null): boolean {
  return role === APP_ADMIN_ROLE;
}

export function isCompanyAdminRole(role: string | undefined | null): boolean {
  return role === COMPANY_ADMIN_ROLE || role === LEGACY_ADMIN_ROLE;
}

export function isCompanyMemberRole(role: string | undefined | null): boolean {
  return role === COMPANY_MEMBER_ROLE || role === LEGACY_CLIENT_ROLE;
}

export function normalizeMemberRole(role: string): string {
  return role === LEGACY_CLIENT_ROLE ? COMPANY_MEMBER_ROLE : role;
}

export const ASSIGNABLE_ROLES = [
  APP_ADMIN_ROLE,
  COMPANY_ADMIN_ROLE,
  COMPANY_MEMBER_ROLE,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** Returns the request user if they are a platform admin, otherwise null. */
export async function requireAppAdmin(): Promise<RequestUser | null> {
  const user = await getRequestUser();
  if (!user || !isAppAdminRole(user.role)) {
    return null;
  }
  return user;
}

/** Returns the request user if they are a company admin, otherwise null. */
export async function requireCompanyAdmin(): Promise<RequestUser | null> {
  const user = await getRequestUser();
  if (!user?.companyId || !isCompanyAdminRole(user.role)) {
    return null;
  }
  return user;
}

export async function countAppAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: APP_ADMIN_ROLE } });
}

export async function isLastAppAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: APP_ADMIN_ROLE },
    select: { id: true },
  });
  if (!user) return false;
  const count = await countAppAdmins();
  return count <= 1;
}

function effectiveCompanyId(
  role: string,
  realCompanyId: string | null,
  impersonatedCompanyId: string | null
): string | null {
  if (isAppAdminRole(role) && impersonatedCompanyId) {
    return impersonatedCompanyId;
  }
  return realCompanyId;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/client-login',
    error: '/client-login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.realCompanyId = (user as { companyId?: string | null }).companyId ?? null;
        token.impersonatedCompanyId = null;
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, companyId: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.realCompanyId = dbUser.companyId;
          if (!isAppAdminRole(dbUser.role)) {
            token.impersonatedCompanyId = null;
          }
        }
      }

      if (trigger === 'update' && session && isAppAdminRole(token.role as string)) {
        const impersonate = (session as { impersonate?: string | null }).impersonate;
        if (impersonate === null || impersonate === undefined) {
          token.impersonatedCompanyId = null;
        } else if (typeof impersonate === 'string') {
          token.impersonatedCompanyId = impersonate;
        }
      }

      return token;
    },
    async session({ session, token }) {
      const role = token.role as string;
      const isAppAdmin = isAppAdminRole(role);
      const realCompanyId =
        (token.realCompanyId as string | null | undefined) ??
        ((token as { companyId?: string | null }).companyId ?? null);
      const impersonatedCompanyId = isAppAdmin
        ? ((token.impersonatedCompanyId as string | null | undefined) ?? null)
        : null;

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = role;
        session.user.companyId = effectiveCompanyId(role, realCompanyId, impersonatedCompanyId);
        session.user.isAppAdmin = isAppAdmin;
        session.user.isImpersonating = Boolean(isAppAdmin && impersonatedCompanyId);
      }
      return session;
    },
  },
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      companyId?: string | null;
      isAppAdmin?: boolean;
      isImpersonating?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    realCompanyId?: string | null;
    impersonatedCompanyId?: string | null;
  }
}
