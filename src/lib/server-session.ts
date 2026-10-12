import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Deduplicates Better Auth session verification within one server render. */
export const getServerSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
