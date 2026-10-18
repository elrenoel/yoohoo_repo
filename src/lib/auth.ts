import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { APIError } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { captcha, emailOTP, haveIBeenPwned } from "better-auth/plugins";
import { PASSWORD_RULES } from "./password-rules";

export { PASSWORD_RULES } from "./password-rules";

// Fase 5 CSP reminder: allow https://challenges.cloudflare.com in script-src
// and frame-src so the Turnstile widget can load and render.

const authDatabaseUrl = process.env.SUPABASE_DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
const authPool = new Pool({ connectionString: authDatabaseUrl, ssl: { rejectUnauthorized: false }, max: 5 });
if (process.env.NODE_ENV === "production" && !process.env.TURNSTILE_SECRET_KEY) {
  throw new Error("TURNSTILE_SECRET_KEY is required in production");
}
if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required in production for email verification");
}

async function sendVerificationEmail({ user, url }: { user: { email: string; name: string }; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") console.warn("Email verification URL (development only):", url);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Yoohoo <onboarding@resend.dev>",
      to: [user.email],
      subject: "Verify your Yoohoo email",
      text: `Hi ${user.name},\n\nVerify your email by opening this link:\n${url}\n\nThis link expires in 60 minutes.`,
    }),
  });
  if (!response.ok) throw new Error("Unable to send verification email");
}

async function sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: "sign-in" | "email-verification" | "forget-password" | "change-email" }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") console.warn("OTP generated for development:", { email, type });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Yoohoo <onboarding@resend.dev>",
      to: [email],
      subject: type === "sign-in" ? "Your Yoohoo login code" : "Your Yoohoo verification code",
      text: `Your Yoohoo verification code is ${otp}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw new Error("Unable to send OTP email");
}

async function sendPasswordResetEmail({ user, url }: { user: { email: string; name: string }; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") console.warn("Password reset URL (development only):", url);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Yoohoo <onboarding@resend.dev>",
      to: [user.email],
      subject: "Set or reset your Yoohoo password",
      text: `Hi ${user.name},\n\nSet or reset your Yoohoo password by opening this link:\n${url}\n\nThis link expires in 60 minutes. If you did not request this, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error("Unable to send password reset email");
}

/**
 * Payload carried inside the OAuth callback error when the login page's
 * "Login dengan Google" hits an email that is not registered yet.
 *
 * Better Auth's social callback surfaces this as `?error=<value>` on the
 * error redirect. The value goes through `error.split(" ").join("_")`, so
 * JSON.stringify is used (no spaces) and literal spaces inside the name are
 * encoded as "+" to survive that transform. The `after` hook below parses
 * it back and redirects to /register with the Google profile prefilled.
 */
interface NotRegisteredPayload {
  code: "user_not_registered";
  email: string;
  name: string;
}

function encodeNotRegisteredPayload(email: string, name: string): string {
  const payload: NotRegisteredPayload = {
    code: "user_not_registered",
    email,
    name: name.replace(/ /g, "+"),
  };
  return JSON.stringify(payload);
}

function decodeNotRegisteredPayload(error: string): { email: string; name: string } | null {
  try {
    const parsed = JSON.parse(error) as Partial<NotRegisteredPayload>;
    if (parsed?.code !== "user_not_registered") return null;
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      name: typeof parsed.name === "string" ? parsed.name.replace(/\+/g, " ") : "",
    };
  } catch {
    return null;
  }
}

/**
 * Shared password validation rules.
 * These same rules are enforced on the server (below) and
 * displayed in the register form on the client.
 */
/**
 * Standard email regex (RFC 5322 simplified).
 * Better Auth already validates email via zod z.email() in its sign-up route,
 * but we export this so the client can show the same error message format.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  trustedOrigins: [
    "http://localhost:3000",
    "https://www.yoohoo.my.id",
    "https://yoohoo.my.id",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
  database: authPool,
  verification: {
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
  },
  emailVerification: {
    requireEmailVerification: true,
    sendResetPassword: sendPasswordResetEmail,
    revokeSessionsOnPasswordReset: true,
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Enforce minimum length at the Better Auth level (server-side).
    minPasswordLength: PASSWORD_RULES.minLength,
    maxPasswordLength: PASSWORD_RULES.maxLength,
    password: {
      /**
       * Wrap the default hash function to add extra complexity checks
       * (letter + number requirement) that Better Auth doesn't natively enforce.
       * This runs *before* hashing so an invalid password never reaches the DB.
       */
      hash: async (password: string) => {
        if (!PASSWORD_RULES.hasLetter.test(password)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Kata sandi harus mengandung minimal satu huruf dan satu angka.",
          });
        }
        if (!PASSWORD_RULES.hasNumber.test(password)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Kata sandi harus mengandung minimal satu huruf dan satu angka.",
          });
        }
        // Delegate to the default scrypt hasher from the public utils package
        const { hashPassword } = await import("@better-auth/utils/password");
        return hashPassword(password);
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 5,
    modelName: "rate_limit",
    fields: { lastRequest: "last_request" },
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
      "/reset-password/*": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 5 },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      ipv6Subnet: 64,
    },
  },
  plugins: [
    emailOTP({
      sendVerificationOTP,
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      storeOTP: "hashed",
      rateLimit: { window: 60, max: 1 },
    }),
    haveIBeenPwned({
      customPasswordCompromisedMessage: "Kata sandi ini pernah bocor. Gunakan kata sandi lain.",
    }),
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: process.env.TURNSTILE_SECRET_KEY || "",
          endpoints: ["/sign-up/email", "/forget-password", "/send-verification-email"],
          allowedHostnames: ["yoohoo.my.id", "www.yoohoo.my.id", "localhost"],
        }),
      ]
      : []),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  account: {
    fields: { accountId: "account_id", providerId: "provider_id", userId: "user_id", accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at" },
    accountLinking: {
      // Allow an existing account (e.g. registered via email/password with an
      // unverified email) to sign in through Google by linking automatically.
      // Without this, an existing user clicking "Login dengan Google" would be
      // rejected with `account_not_linked` instead of getting a session.
      requireLocalEmailVerified: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Only gate OAuth (social) sign-ups. Email/password sign-up uses a
          // different route and must keep working as-is.
          if (context?.path !== "/callback/:id") return;
          const state = await getOAuthState();
          // The register page explicitly requests sign-up (requestSignUp: true)
          // → creating a new account is allowed there.
          if (state?.requestSignUp) return;
          // The login page must never silently create an account: throw a
          // structured payload so the `after` hook below can redirect to
          // /register with the Google profile prefilled.
          throw new APIError("BAD_REQUEST", {
            message: encodeNotRegisteredPayload(
              user.email ?? "",
              user.name ?? ""
            ),
          });
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Only the OAuth callback redirect matters here.
      if (ctx.path !== "/callback/:id") return;

      const state = await getOAuthState();
      const headers = ctx.context.responseHeaders;
      const location = headers?.get("location");
      if (!headers || !location) return;

      const baseURL = ctx.context.baseURL;
      const url = new URL(location, baseURL);

      if (state?.requestSignUp) {
        // ---- Register page flow ----
        if (url.searchParams.get("error")) return; // genuine failure → keep error redirect

        const callbackPath = new URL(state.callbackURL ?? "/", baseURL).pathname;
        const newUserPath = state.newUserURL
          ? new URL(state.newUserURL, baseURL).pathname
          : null;

        if (newUserPath && url.pathname === newUserPath) {
          // Fresh account created → continue into the app (session is active).
          headers.set("location", new URL(state.callbackURL ?? "/", baseURL).toString());
        } else if (url.pathname === callbackPath) {
          // Email already registered → send the user back to /login.
          headers.set(
            "location",
            new URL("/login?google_error=already_registered", baseURL).toString()
          );
        }
        return;
      }

      // ---- Login page flow ----
      const error = url.searchParams.get("error");
      if (!error) return;
      const profile = decodeNotRegisteredPayload(error);
      if (!profile) return; // unrelated OAuth error → keep the error redirect

      // Email is not registered → redirect to /register with the Google
      // profile prefilled so the user doesn't have to retype it.
      const target = new URL("/register", baseURL);
      target.searchParams.set("google_error", "not_registered");
      if (profile.email) target.searchParams.set("email", profile.email);
      if (profile.name) target.searchParams.set("name", profile.name);
      headers.set("location", target.toString());
    }),
  },
  session: {
    // Sessions are intentionally capped at one day. The signed cookie cache
    // avoids a Postgres lookup every time server code asks for the session.
    expiresIn: 60 * 60 * 24,
    disableSessionRefresh: true,
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at", ipAddress: "ip_address", userAgent: "user_agent", userId: "user_id" },
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24,
    },
  },
  user: {
    fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
    additionalFields: {
      generationCountToday: {
        type: "number",
        defaultValue: 0,
        fieldName: "generation_count_today",
      },
      lastGenerationDate: {
        type: "string",
        required: false,
        fieldName: "last_generation_date",
      },
    },
  },
});
