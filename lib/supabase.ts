import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * ------------------------------------------------------------------
 * Supabase helpers
 *
 *  • During local / preview runs the environment variables for
 *    Supabase might be undefined.  Creating the client with an empty
 *    string causes the SDK to throw “supabaseUrl is required”.
 *
 *  • We therefore provide harmless fall-back strings so the client
 *    can be instantiated and the UI can render.  You’ll still need
 *    to supply real keys for any production deployment.
 * ------------------------------------------------------------------
 */

const fallbackUrl = "https://project-ref.supabase.co" // dummy URL
const fallbackKey = "public-anon-key" // dummy anon key

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || fallbackUrl

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || fallbackKey

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable persisted sessions in the browser during preview so we
    // don’t hit IndexedDB errors without a real backend.
    persistSession: false,
  },
})

/**
 * createServerClient
 * ---------------------------------------------------------------
 * Used on the server where the Service-Role key is expected.
 * If it’s missing we fall back to the same anon client so SSR
 * doesn’t throw during the preview.
 * ---------------------------------------------------------------
 */
export const createServerClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || fallbackUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || fallbackKey,
  )
