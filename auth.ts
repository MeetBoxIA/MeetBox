/**
 * NextAuth v5 configuration for MeetBox.
 * Supports two providers:
 *   - Google OAuth  — upserts the user row in Supabase on every sign-in
 *   - Credentials   — email+password OR post-OTP-verification shortcut
 *
 * The JWT strategy stores the Supabase UUID (not the OAuth sub) so every
 * API route receives the correct internal ID via session.user.id.
 */
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
        email:       { label: "Email",    type: "email"    },
        password:    { label: "Password", type: "password" },
        otpVerified: { label: "OTP verified", type: "text" },
      },
      async authorize(credentials) {
        const email       = credentials?.email       as string;
        const password    = credentials?.password    as string;
        const otpVerified = credentials?.otpVerified as string;
        if (!email) return null;

        const db = getSupabase();

        // ── Post-registration shortcut (OTP already verified) ──────────
        // The register flow saves the user to DB and then calls signIn
        // with otpVerified="true" to skip the password check entirely.
        if (otpVerified === "true") {
          const { data: user } = await db
            .from("users")
            .select("id, name, email, avatar_url")
            .eq("email", email)
            .single<DbUser>();
          if (!user) return null;
          return { id: user.id, email: user.email, name: user.name, image: user.avatar_url };
        }

        // ── Normal email + password login ──────────────────────────────
        const { data: user } = await db
          .from("users")
          .select("id, name, email, password_hash, avatar_url")
          .eq("email", email)
          .eq("provider", "email") // prevent Google users from logging in with a password
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
    // Upsert the Google user into Supabase on every OAuth sign-in so the
    // profile (name, avatar) stays fresh if the user updates it in Google.
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

    async jwt({ token, user, account }) {
      if (user?.id)    token.id      = user.id;
      if (user?.image) token.picture = user.image;

      // For Google, user.id is the OAuth sub — not our Supabase UUID.
      // We look up the real UUID and the latest avatar so the token always
      // carries the correct internal ID even after the first sign-in.
      if (account?.provider === "google" && user?.email) {
        const { data } = await getSupabase()
          .from("users")
          .select("id, avatar_url")
          .eq("email", user.email)
          .single();
        if (data?.id)         token.id      = data.id;
        if (data?.avatar_url) token.picture = data.avatar_url;
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.id)      session.user.id    = token.id      as string;
      if (token?.picture) session.user.image = token.picture as string;
      return session;
    },
  },
});
