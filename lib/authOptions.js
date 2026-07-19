import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hashSync } from "bcrypt";
import { COMPANY_ID } from "@config/company";
import { ROLE } from "@models/user";
import { User } from "@models/user";
import { connectToDB } from "@lib/database";
import {
  getDefaultOwnerId,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";

/**
 * Dual-domain auth (carsnk.gr + cars.bbqr.site):
 * - Prefer leaving NEXTAUTH_URL unset on Vercel (host-aware cookies).
 * - Primary login: MongoDB User (email + password hash).
 * - Bootstrap fallback: AUTH_* env users (until DB users are seeded).
 */
if (
  process.env.NEXTAUTH_URL &&
  /vercel\.app$/i.test(String(process.env.NEXTAUTH_URL))
) {
  delete process.env.NEXTAUTH_URL;
}

function envTrim(name) {
  return String(process.env[name] || "").trim();
}

function buildEnvCredentialUser({ id, name, email, password, role, ownerId }) {
  if (!email || !password) return null;
  return {
    id,
    name,
    email,
    password: hashSync(password, 10),
    isAdmin: true,
    companyId: COMPANY_ID,
    ownerId: ownerId || null,
    role,
    fromDb: false,
  };
}

/** Env bootstrap users (used only if DB User not found for that email). */
const envBootstrapUsers = [
  buildEnvCredentialUser({
    id: "admin",
    name: "Admin",
    email: envTrim("AUTH_ADMIN_EMAIL"),
    password: envTrim("AUTH_ADMIN_PASSWORD"),
    role: ROLE.ADMIN,
    ownerId: getDefaultOwnerId(),
  }),
  buildEnvCredentialUser({
    id: "superadmin",
    name: "Superadmin",
    email: envTrim("AUTH_SUPERADMIN_EMAIL"),
    password: envTrim("AUTH_SUPERADMIN_PASSWORD"),
    role: ROLE.SUPERADMIN,
    ownerId: null,
  }),
].filter(Boolean);

function isLocalDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production";
}

function toSessionUser({
  id,
  name,
  email,
  role,
  ownerId,
  companyId,
}) {
  const normalizedOwner =
    Number(role) === ROLE.SUPERADMIN
      ? normalizeOwnerId(ownerId)
      : normalizeOwnerId(ownerId) || getDefaultOwnerId();

  return {
    id: String(id),
    name,
    email,
    isAdmin: true,
    role,
    roleId: role,
    companyId: companyId || COMPANY_ID,
    ownerId: normalizedOwner,
  };
}

async function findDbUserByEmail(email) {
  await connectToDB();
  return User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
          try {
            await connectToDB();
            const dbSuper = await User.findOne({ role: ROLE.SUPERADMIN }).lean();
            if (dbSuper) {
              return toSessionUser({
                id: dbSuper._id,
                name: dbSuper.username || "Superadmin",
                email: dbSuper.email,
                role: ROLE.SUPERADMIN,
                ownerId: dbSuper.ownerId,
                companyId: COMPANY_ID,
              });
            }
          } catch {
            /* fall through to env */
          }
          const envSuper = envBootstrapUsers.find(
            (u) => u.role === ROLE.SUPERADMIN
          );
          if (!envSuper) return null;
          console.log("✅ Local empty credentials → Superadmin");
          return toSessionUser(envSuper);
        }

        if (!email || !password) {
          console.log("❌ No credentials provided");
          return null;
        }

        try {
          const dbUser = await findDbUserByEmail(email);
          if (dbUser?.password) {
            const ok = await compare(password, dbUser.password);
            if (!ok) {
              console.log("❌ Invalid password for DB user:", email);
              return null;
            }
            if (!dbUser.isAdmin) {
              console.log("❌ User is not admin:", email);
              return null;
            }
            return toSessionUser({
              id: dbUser._id,
              name: dbUser.username || dbUser.email,
              email: dbUser.email,
              role: dbUser.role ?? ROLE.ADMIN,
              ownerId: dbUser.ownerId,
              companyId: COMPANY_ID,
            });
          }
        } catch (error) {
          console.error("❌ DB auth lookup error:", error);
        }

        const envUser = envBootstrapUsers.find(
          (user) => user.email.toLowerCase() === email.toLowerCase()
        );
        if (!envUser) {
          console.log("❌ No admin user found for email:", email);
          return null;
        }

        try {
          const isValid = await compare(password, envUser.password);
          if (!isValid) {
            console.log("❌ Invalid password for env user:", envUser.email);
            return null;
          }
          return toSessionUser(envUser);
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
        token.ownerId = user.ownerId ?? null;
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
        session.user.ownerId = token.ownerId ?? null;
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
