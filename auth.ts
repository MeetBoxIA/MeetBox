import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getSupabase, type DbUser } from "./src/lib/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email:       { label: "Email",        type: "email"    },
        password:    { label: "Contraseña",   type: "password" },
        otpVerified: { label: "OTP verified", type: "text"     },
      },
      async authorize(credentials) {
        const email       = credentials?.email       as string;
        const password    = credentials?.password    as string;
        const otpVerified = credentials?.otpVerified as string;
        if (!email) return null;

        const db = getSupabase();

        // ── Post-registro (OTP verificado → usuario ya guardado en DB) ──
        if (otpVerified === "true") {
          const { data: user } = await db
            .from("users")
            .select("id, name, email, avatar_url")
            .eq("email", email)
            .single<DbUser>();
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.name, image: user.avatar_url };
        }

        // ── Login normal con email + contraseña ──────────────────────────
        const { data: user } = await db
          .from("users")
          .select("id, name, email, password_hash, avatar_url")
          .eq("email", email)
          .eq("provider", "email")
          .single<DbUser>();
        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.avatar_url };
      },
    }),
  ],

  pages: { signIn: "/auth", error: "/auth" },
  session: { strategy: "jwt" },

  callbacks: {
    // Guardar/actualizar usuario de Google en Supabase al primer login
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const db = getSupabase();
        await db.from("users").upsert(
          {
            email:      user.email,
            name:       user.name  ?? user.email,
            avatar_url: user.image ?? null,
            provider:   "google",
          },
          { onConflict: "email", ignoreDuplicates: false },
        );
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },

    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
  },
});
