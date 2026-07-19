import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hashSync } from "bcrypt";
import { COMPANY_ID } from "@config/company";
import { ROLE } from "@models/user";

/**
 * Dual-domain auth (carsnk.gr + cars.bbqr.site):
 * - Do NOT force NEXTAUTH_URL to VERCEL_URL (breaks custom domains).
 * - Prefer leaving NEXTAUTH_URL unset on Vercel so NextAuth uses
 *   X-Forwarded-Host / Host from the request (login works on either apex).
 * - For local: NEXTAUTH_URL=http://localhost:3026 is fine.
 * - Cookies stay host-only (no shared session across .gr / .bbqr.site).
 */
if (
  process.env.NEXTAUTH_URL &&
  /vercel\.app$/i.test(String(process.env.NEXTAUTH_URL))
) {
  delete process.env.NEXTAUTH_URL;
}

// Temporary credentials — change before long-term production use.
// Superadmin login: admin@bbqr.site / password
const TEMP_SUPERADMIN_EMAIL = "admin@bbqr.site";
const TEMP_SUPERADMIN_PASSWORD = "password";

const hashedPassword = hashSync("11111111", 10);
const hashedPasswordSuperadmin = hashSync(TEMP_SUPERADMIN_PASSWORD, 10);

const adminEmail = String(process.env.AUTH_ADMIN_EMAIL || "").trim();
const superadminEmail =
  String(process.env.AUTH_SUPERADMIN_EMAIL || "").trim() || TEMP_SUPERADMIN_EMAIL;

const adminUsers = [
  {
    id: "admin",
    name: "Admin",
    email: adminEmail,
    password: hashedPassword,
    isAdmin: true,
    companyId: COMPANY_ID,
    role: ROLE.ADMIN,
  },
  {
    id: "superadmin",
    name: "Superadmin",
    email: superadminEmail,
    password: hashedPasswordSuperadmin,
    isAdmin: true,
    companyId: COMPANY_ID,
    role: ROLE.SUPERADMIN,
  },
];

function isLocalDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production";
}

function toSessionUser(adminUser) {
  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    isAdmin: true,
    role: adminUser.role,
    roleId: adminUser.role,
    companyId: adminUser.companyId,
  };
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "admin@example.com",
        },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "").trim();

        if (isLocalDevAuthBypassEnabled() && !email && !password) {
          const superadmin = adminUsers.find(
            (user) => user.role === ROLE.SUPERADMIN
          );
          if (!superadmin) return null;
          console.log("✅ Local empty credentials → Superadmin");
          return toSessionUser(superadmin);
        }

        if (!email || !password) {
          console.log("❌ No credentials provided");
          return null;
        }

        const adminUser = adminUsers.find(
          (user) =>
            user.email && user.email.toLowerCase() === email.toLowerCase()
        );

        if (!adminUser) {
          console.log("❌ No admin user found for email:", email);
          return null;
        }

        try {
          const isValid = await compare(password, adminUser.password);
          if (!isValid) {
            console.log("❌ Invalid password for user:", adminUser.email);
            return null;
          }
          return toSessionUser(adminUser);
        } catch (error) {
          console.error("❌ bcrypt compare error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.role = user.role;
        token.roleId = user.roleId;
        token.companyId = user.companyId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin;
        session.user.role = token.role;
        session.user.roleId = token.roleId;
        session.user.companyId = token.companyId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        const base = new URL(baseUrl);
        if (target.origin === base.origin) return url;
      } catch {
        /* fall through */
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
};
