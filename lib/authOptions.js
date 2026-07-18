import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hashSync } from "bcrypt";
import { COMPANY_ID } from "@config/company";
import { ROLE } from "@models/user";

// Preview / multi-host: let NextAuth derive the URL from the request when unset.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
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
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "").trim();

        // Local/dev only: empty email + password → SUPERADMIN.
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
            user.email &&
            user.email.toLowerCase() === email.toLowerCase()
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

        // role — число из ROLE enum: 1 (ADMIN) или 2 (SUPERADMIN)
        token.role = user.role;
        token.roleId = user.roleId;  // для обратной совместимости

        token.companyId = user.companyId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.isAdmin = token.isAdmin;

        // role — число из ROLE enum: 1 (ADMIN) или 2 (SUPERADMIN)
        session.user.role = token.role;
        session.user.roleId = token.roleId;   // для обратной совместимости

        session.user.companyId = token.companyId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};
