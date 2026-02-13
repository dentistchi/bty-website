/**
 * NextAuth configuration with Microsoft Entra ID (Azure AD) for Admin Dashboard.
 * Minimal session fields. No sensitive user info storage.
 * When Entra ID is not configured, Credentials provider allows dev login for BTY_ADMIN_EMAILS.
 */

import type { NextAuthOptions, Session } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";

const ALLOWED = (process.env.BTY_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED.includes(email.trim().toLowerCase());
}

const hasAzure = !!(
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET
);

const providers: NextAuthOptions["providers"] = hasAzure
  ? [
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        tenantId: process.env.AZURE_AD_TENANT_ID,
        authorization: {
          params: { scope: "openid profile email" },
        },
      }),
    ]
  : [
      CredentialsProvider({
        name: "Admin Dev",
        credentials: {
          email: { label: "Email", type: "email" },
          secret: { label: "Dev secret", type: "password" },
        },
        async authorize(creds) {
          const email = creds?.email;
          const secret = process.env.DEV_ADMIN_SECRET || "dev-admin-ok";
          if (!email || creds?.secret !== secret) return null;
          if (!isAllowedEmail(email)) return null;
          return { id: "dev", email };
        },
      }),
    ];

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Credentials provider: persist user email
      if (user?.email) token.email = user.email;
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile?.email) token.email = profile.email;
      if (profile && "roles" in profile && Array.isArray(profile.roles)) {
        token.roles = profile.roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { email?: string }).email = token.email ?? session.user.email ?? undefined;
      }
      (session as { accessToken?: string }).accessToken = token.accessToken as string | undefined;
      (session as { roles?: string[] }).roles = token.roles as string[] | undefined;
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export type SessionWithRoles = Session & {
  user?: { email?: string | null };
  accessToken?: string;
  roles?: string[];
};
