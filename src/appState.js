export function resolveView({ user, userData, serverData, hasProfile, loading }) {
  if (!user) return loading ? 'loading' : 'auth'

  if (serverData?.banned) return 'banned'

  if (hasProfile === false) return 'inactive'

  if (loading && !userData) return 'loading'

  return 'app'
}

export function mergeProfile(userData, serverData) {
  return { ...(userData || {}), ...(serverData || {}) }
}
