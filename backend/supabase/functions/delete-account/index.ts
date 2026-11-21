import { createClient } from 'npm:@supabase/supabase-js@2.119.2'
import { supabaseAccountDeletion } from './adapters/supabase.ts'
import { deleteAccount } from './application/delete-account.ts'
import { createDeleteAccountHandler } from './http.ts'

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}

Deno.serve(
  createDeleteAccountHandler(() => {
    const url = Deno.env.get('SUPABASE_URL')
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !publicKey || !secret) return null

    return deleteAccount(
      supabaseAccountDeletion(createClient(url, publicKey, options), () =>
        createClient(url, secret, options)
      )
    )
  })
)
