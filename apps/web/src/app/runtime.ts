import type { Scope } from '../domain/space'
import { createSession } from '../application/session'
import { authentication } from '../data/authentication'
import { projectUrl, webUrl } from '../data/supabase'
import { sessionLinks } from '../platform/sessionLinks'
import { workspaces } from './workspaceServices'
import { mobileNavigation } from '../platform/mobileNavigation'
import { createRepertoireServices } from './repertoireServices'

export const runtime = {
  session: createSession(authentication, sessionLinks(projectUrl, webUrl)),
  workspaces,
  navigation: mobileNavigation,
  repertoireFor: (scope: Scope) =>
    createRepertoireServices(scope, () => workspaces.sameScope(scope)),
  webUrl,
}
