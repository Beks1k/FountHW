import { resolveView, mergeProfile } from './src/appState.js'

let passed = 0
let failed = 0

function check(name, actual, expected) {
  if (actual === expected) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name} -> got "${actual}", expected "${expected}"`)
  }
}

function checkTrue(name, value) {
  check(name, value ? true : false, true)
}

const user = { uid: 'u1', email: 'a@b.com' }

console.log('\n--- signed out ---')
check(
  'no user shows the sign-in screen',
  resolveView({ user: null, userData: null, serverData: null, hasProfile: null, loading: false }),
  'auth'
)

console.log('\n--- the bug that was reported ---')
check(
  'stale cache says banned, server says not banned -> app (not banned screen)',
  resolveView({
    user,
    userData: { banned: true, role: 'student' },
    serverData: { banned: false, role: 'student' },
    hasProfile: true,
    loading: false,
  }),
  'app'
)
check(
  'stale cache says no profile, server says profile exists -> app',
  resolveView({
    user,
    userData: null,
    serverData: { banned: false, role: 'teacher' },
    hasProfile: true,
    loading: false,
  }),
  'app'
)

console.log('\n--- server state always wins ---')
check(
  'server says banned -> banned screen',
  resolveView({
    user,
    userData: { banned: false },
    serverData: { banned: true },
    hasProfile: true,
    loading: false,
  }),
  'banned'
)
check(
  'server says no profile -> inactive screen',
  resolveView({
    user,
    userData: { banned: false },
    serverData: null,
    hasProfile: false,
    loading: false,
  }),
  'inactive'
)
check(
  'server says banned even with no cache -> banned screen',
  resolveView({
    user,
    userData: null,
    serverData: { banned: true },
    hasProfile: true,
    loading: false,
  }),
  'banned'
)

console.log('\n--- loading behaviour ---')
check(
  'no data at all -> spinner',
  resolveView({ user, userData: null, serverData: null, hasProfile: null, loading: true }),
  'loading'
)
check(
  'cached data available -> render immediately, no spinner',
  resolveView({
    user,
    userData: { banned: false, role: 'student' },
    serverData: null,
    hasProfile: null,
    loading: true,
  }),
  'app'
)

console.log('\n--- profile merge ---')
const merged = mergeProfile(
  { role: 'student', groupId: 'g1', username: 'Old' },
  { role: 'teacher', groupId: 'g2' }
)
check('server fields override cached fields', merged.role, 'teacher')
check('server groupId wins', merged.groupId, 'g2')
check('cached fields survive when server omits them', merged.username, 'Old')

console.log(`\n===== ${passed} passed, ${failed} failed =====\n`)
process.exit(failed > 0 ? 1 : 0)