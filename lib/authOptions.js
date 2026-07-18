import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hashSync } from "bcrypt";
import { COMPANY_ID } from "@config/company";
import { ROLE, ROLE_NAME } from "@models/user";

// Preview / multi-host: let NextAuth derive the URL from the request when unset.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

// Pre-hash the password synchronously
const hashedPassword = hashSync("11111111", 10);
const hashedPasswordSuperadmin = hashSync("1111111111", 10);

const adminEmail = String(process.env.AUTH_ADMIN_EMAIL || "").trim();
const superadminEmail = String(process.env.AUTH_SUPERADMIN_EMAIL || "").trim();

const adminUsers = [{
  id: "admin",
  name: "Admin",
  email: adminEmail,
  password: hashedPassword,
  isAdmin: true,
  companyId: COMPANY_ID,
  role: ROLE.ADMIN,
},{
  id: "superadmin",
  name: "Superadmin",
  email: superadminEmail,
  password: hashedPasswordSuperadmin,
  isAdmin: true,
  companyId: COMPANY_ID,
  role: ROLE.SUPERADMIN,
}]

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
        console.log("🔐 Authorize called with email:", credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log("❌ No credentials provided");
          return null;
        }

        // 1️⃣ ищем пользователя по email
        const adminUser = adminUsers.find(
          (user) => user.email.toLowerCase() === credentials.email.toLowerCase()
        );

        if (!adminUser) {
          console.log("❌ No admin user found for email:", credentials.email);
          return null;
        }

        console.log("✅ Admin user found:", adminUser.name);

        // 2️⃣ проверяем пароль
        try {
          // ВАЖНО: compare принимает (plainPassword, hashedPassword)
          const isValid = await compare(
            credentials.password,
            adminUser.password
          );

          if (!isValid) {
            console.log("❌ Invalid password for user:", adminUser.email);
            return null;
          }

          console.log("✅ Password valid, returning user:", adminUser.email);

          return {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
            isAdmin: true,

            // 🔥 ВАЖНО: role — число из ROLE enum (models/user.js)
            role: adminUser.role,                 // 1 (ADMIN) или 2 (SUPERADMIN)
            roleId: adminUser.role,               // для обратной совместимости

            companyId: adminUser.companyId,
          };
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
