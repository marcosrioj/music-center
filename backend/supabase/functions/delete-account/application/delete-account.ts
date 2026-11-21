export interface AccountDeletionPorts {
  authenticatedAccountId(token: string): Promise<string | null>
  prepareOwnedSpaces(accountId: string): Promise<readonly string[]>
  removeSpaceScores(spaceId: string): Promise<void>
  deleteIdentity(accountId: string): Promise<void>
}

export type DeleteAccount = (
  token: string
) => Promise<'unauthenticated' | 'deleted'>

export function deleteAccount(ports: AccountDeletionPorts): DeleteAccount {
  return async (token) => {
    const accountId = await ports.authenticatedAccountId(token)
    if (accountId === null) return 'unauthenticated'

    // Preparation blocks new uploads and can be repeated after interrupted cleanup.
    const ownedSpaces = await ports.prepareOwnedSpaces(accountId)
    for (const spaceId of ownedSpaces) {
      await ports.removeSpaceScores(spaceId)
    }
    await ports.deleteIdentity(accountId)
    return 'deleted'
  }
}
