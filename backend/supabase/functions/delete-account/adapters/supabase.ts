import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.2'
import type { AccountDeletionPorts } from '../application/delete-account.ts'

async function emptyFolder(
  client: SupabaseClient,
  folder: string
): Promise<void> {
  const bucket = client.storage.from('musiccenter-scores')
  // Deleting entries shifts the page offsets. Drain the first page until the prefix is empty.
  while (true) {
    const { data, error } = await bucket.list(folder, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error || !data) throw new Error('storage.list')
    if (!data.length) return

    const paths: string[] = []
    for (const entry of data) {
      if (
        !entry.name ||
        entry.name === '.' ||
        entry.name === '..' ||
        entry.name.includes('/')
      ) {
        throw new Error('storage.path')
      }
      const path = folder + '/' + entry.name
      if (entry.id) paths.push(path)
      else await emptyFolder(client, path)
    }
    if (paths.length) {
      const { data: removed, error: removeError } = await bucket.remove(paths)
      if (removeError || !removed?.length) throw new Error('storage.remove')
    }
  }
}

export function supabaseAccountDeletion(
  publicClient: SupabaseClient,
  createServiceClient: () => SupabaseClient
): AccountDeletionPorts {
  let service: SupabaseClient | undefined
  const admin = () => (service ??= createServiceClient())

  return {
    async authenticatedAccountId(token) {
      const {
        data: { user },
        error,
      } = await publicClient.auth.getUser(token)
      return error || !user || user.is_anonymous ? null : user.id
    },
    async prepareOwnedSpaces(accountId) {
      const { data, error } = await admin().rpc('mc_prepare_account_deletion', {
        p_user: accountId,
      })
      if (error || !Array.isArray(data)) throw new Error('account.prepare')
      return data
    },
    async removeSpaceScores(spaceId) {
      if (
        typeof spaceId !== 'string' ||
        !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(spaceId)
      ) {
        throw new Error('account.space')
      }
      await emptyFolder(admin(), spaceId)
    },
    async deleteIdentity(accountId) {
      const { error } = await admin().auth.admin.deleteUser(accountId)
      if (error) throw new Error('account.delete')
    },
  }
}
