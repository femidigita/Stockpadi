import { createClient } from "@supabase/supabase-js"

let supabaseAdmin: ReturnType<typeof createClient>

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add your Supabase service-role key to the Vercel environment variables (Server only).",
    )
  }

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing")
  }

  // Create singleton admin client
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return supabaseAdmin
}

// Create a regular client for non-admin operations
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  })
}
