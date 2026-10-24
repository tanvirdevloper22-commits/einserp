import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only allow a redirect to a path on this site. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** Landing point of the email link: swaps the one-time code for a signed-in session, then continues. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/forgot-password?error=${encodeURIComponent(message)}`);

  if (searchParams.get("error")) {
    return fail("That link is invalid or has expired. Request a new one.");
  }
  if (!code) return fail("That link is not valid. Request a new one.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail("That link has expired or was opened in a different browser. Request a new one and open it in the same browser.");
  }
  return NextResponse.redirect(`${origin}${next}`);
}
