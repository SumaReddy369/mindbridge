import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns Supabase auth user id when `Authorization: Bearer <access_token>` is valid.
 */
export async function getUserIdFromSupabaseBearer(
  req: NextRequest
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}
