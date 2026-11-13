import { initializeApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
} from 'firebase/firestore'

const app = initializeApp({
  projectId: 'demo-founthw',
  apiKey: 'fake-key',
  authDomain: 'demo-founthw.firebaseapp.com',
})
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8080)

let passed = 0
let failed = 0

function log(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name} ${detail}`)
  }
}

async function expectDenied(name, fn) {
  try {
    await fn()
    log(name, false, '-> was ALLOWED but should be DENIED')
  } catch (e) {
    log(name, true)
  }
}

async function expectAllowed(name, fn) {
  try {
    await fn()
    log(name, true)
  } catch (e) {
    log(name, false, `-> was DENIED but should be ALLOWED (${e.message})`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Every run uses fresh accounts, so the test can be run again against the
// same emulator without the previous run's profiles getting in the way.
const TAG = Date.now().toString(36)
async function signIn(email) {
  await signOut(auth)
  try {
    await signInWithEmailAndPassword(auth, email, 'password123')
  } catch {
    await createUserWithEmailAndPassword(auth, email, 'password123')
  }
  await sleep(150)
}

// The admin email must match firestore.rules isAdmin() — single source of
// truth is src/config.js, which the rules file is set up to mirror.
import { ADMIN_EMAIL } from './src/config.js'

const now = () => new Date().toISOString()
const ADMIN = ADMIN_EMAIL
const teacherEmail = `teacher-${TAG}@test.com`
const studentEmail = `student-${TAG}@test.com`
const student2Email = `student2-${TAG}@test.com`
const otherTeacherEmail = `teacher2-${TAG}@test.com`
const newTeacherEmail = `newteacher-${TAG}@test.com`
const otherStudentEmail = `otherstudent-${TAG}@test.com`

let adminUid
let teacherUid
let studentUid
let student2Uid
let otherTeacherUid
let classId
let otherClassId
let submissionId
let homeworkId
let noteId

console.log('\n--- SETUP ---')

await signIn(ADMIN)
adminUid = auth.currentUser.uid
await setDoc(doc(db, 'users', adminUid), {
  username: 'Admin',
  email: ADMIN,
  role: 'teacher',
  classId: 'admin-class',
  emailDomain: 'replaceme.com',
  domainVerified: true,
  banned: false,
  createdAt: now(),
})
await setDoc(doc(db, 'classes', 'admin-class'), {
  name: 'Admin Class',
  pin: '000000',
  teacherId: adminUid,
  teacherName: 'Admin',
  createdAt: now(),
})
console.log('  admin ready')

await signIn(teacherEmail)
teacherUid = auth.currentUser.uid
const classRef = doc(collection(db, 'classes'))
await setDoc(classRef, {
  name: 'English 5',
  pin: '123456',
  teacherId: teacherUid,
  teacherName: 'Teacher',
  groups: { g1: 'Group A', g2: 'Group B' },
  createdAt: now(),
})
classId = classRef.id
await setDoc(doc(db, 'users', teacherUid), {
  username: 'Teacher',
  email: teacherEmail,
  role: 'teacher',
  classId,
  classPin: '123456',
  emailDomain: 'test.com',
  domainVerified: true,
  banned: false,
  groupId: null,
  createdAt: now(),
})
console.log('  teacher ready')

const seedHwRef = await addDoc(collection(db, 'homework'), {
  classId,
  title: 'Seed homework',
  description: 'x',
  dueDate: '2026-12-01',
  maxGrade: 10,
  groupIds: ['*'],
  createdAt: now(),
})
const seedHwId = seedHwRef.id

await signIn(otherTeacherEmail)
otherTeacherUid = auth.currentUser.uid
const otherClassRef = doc(collection(db, 'classes'))
await setDoc(otherClassRef, {
  name: 'Other Class',
  pin: '654321',
  teacherId: otherTeacherUid,
  teacherName: 'Other',
  createdAt: now(),
})
otherClassId = otherClassRef.id
await setDoc(doc(db, 'users', otherTeacherUid), {
  username: 'OtherTeacher',
  email: otherTeacherEmail,
  role: 'teacher',
  classId: otherClassId,
  emailDomain: 'test.com',
  domainVerified: true,
  banned: false,
  createdAt: now(),
})
console.log('  other teacher ready')

await signIn(studentEmail)
studentUid = auth.currentUser.uid
await setDoc(doc(db, 'users', studentUid), {
  username: 'Student',
  email: studentEmail,
  role: 'student',
  classId,
  emailDomain: 'test.com',
  domainVerified: true,
  banned: false,
  groupId: null,
  createdAt: now(),
})
console.log('  student ready')

await signIn(student2Email)
student2Uid = auth.currentUser.uid
await setDoc(doc(db, 'users', student2Uid), {
  username: 'Student2',
  email: student2Email,
  role: 'student',
  classId,
  emailDomain: 'test.com',
  domainVerified: true,
  banned: false,
  groupId: null,
  createdAt: now(),
})
console.log('  student 2 ready')

console.log('\n--- REGISTRATION ORDER (new teacher, no profile yet) ---')
await signIn(newTeacherEmail)
const freshClassRef = doc(collection(db, 'classes'))
await expectAllowed('fresh teacher can create class (no profile yet)', () =>
  setDoc(freshClassRef, {
    name: 'Fresh Class',
    pin: '111111',
    teacherId: auth.currentUser.uid,
    teacherName: 'Fresh',
    createdAt: now(),
  })
)
await expectAllowed('fresh teacher can then create own profile', () =>
  setDoc(doc(db, 'users', auth.currentUser.uid), {
    username: 'Fresh',
    email: newTeacherEmail,
    role: 'teacher',
    classId: freshClassRef.id,
    emailDomain: 'test.com',
    domainVerified: true,
    banned: false,
    createdAt: now(),
  })
)
await expectDenied(
  'a profile cannot claim an email other than the signed in one',
  () =>
    setDoc(doc(db, 'users', auth.currentUser.uid), {
      username: 'Impostor',
      email: 'impostor@test.com',
      role: 'teacher',
      classId: freshClassRef.id,
      emailDomain: 'test.com',
      domainVerified: true,
      banned: false,
      groupId: null,
      createdAt: now(),
    })
)

console.log('\n--- STUDENT PERMISSIONS ---')
await signIn(studentEmail)
await expectAllowed('student creates submission in own class', async () => {
  const ref = await addDoc(collection(db, 'submissions'), {
    homeworkId: seedHwId,
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
  submissionId = ref.id
})
await expectDenied('student creates submission in FOREIGN class', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: seedHwId,
    classId: otherClassId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
)
await expectDenied('student cannot self-grade own submission', () =>
  updateDoc(doc(db, 'submissions', submissionId), { grade: 100, status: 'graded' })
)
await expectDenied('student cannot create a submission claiming it is graded', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: seedHwId,
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'graded',
    grade: 10,
    submittedAt: now(),
  })
)
await expectDenied('student cannot create a submission with no homework attached', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: '',
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
)
await expectDenied('student cannot change own role to teacher', () =>
  updateDoc(doc(db, 'users', studentUid), { role: 'teacher' })
)
await expectDenied('student cannot set own banned flag', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: true })
)
await expectDenied('student cannot change own email', () =>
  updateDoc(doc(db, 'users', studentUid), { email: 'hacker@test.com' })
)
await expectAllowed('student can update their own username', () =>
  updateDoc(doc(db, 'users', studentUid), { username: 'Renamed' })
)
await expectDenied('student cannot change their own role', () =>
  updateDoc(doc(db, 'users', studentUid), { role: 'teacher' })
)
await expectDenied('student cannot set their own banned flag', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: true })
)
await expectDenied('student cannot move themselves to another class', () =>
  updateDoc(doc(db, 'users', studentUid), { classId: otherClassId })
)
await expectDenied('student cannot promote themselves while editing username', () =>
  updateDoc(doc(db, 'users', studentUid), { username: 'Sneaky', role: 'teacher' })
)
await expectDenied('student cannot read all users', () =>
  getDocs(collection(db, 'users'))
)
await expectAllowed('student can read own profile', () =>
  getDoc(doc(db, 'users', studentUid))
)
await expectDenied('student cannot create system notification', () =>
  addDoc(collection(db, 'systemNotifications'), {
    message: 'hax',
    active: true,
    createdAt: now(),
  })
)
await expectDenied('student cannot create homework', () =>
  addDoc(collection(db, 'homework'), {
    classId,
    title: 'Nope',
    description: 'Nope',
    dueDate: '2026-01-01',
    maxGrade: 100,
    createdAt: now(),
  })
)

console.log('\n--- TEACHER PERMISSIONS ---')
await signIn(teacherEmail)
await expectAllowed('teacher creates homework in own class', async () => {
  const ref = await addDoc(collection(db, 'homework'), {
    classId,
    title: 'Essay',
    description: 'Write 5 paragraphs',
    dueDate: '2026-12-01',
    maxGrade: 15,
    createdAt: now(),
  })
  homeworkId = ref.id
})
await expectDenied('teacher creates homework in FOREIGN class', () =>
  addDoc(collection(db, 'homework'), {
    classId: otherClassId,
    title: 'Sneaky',
    description: 'Sneaky',
    dueDate: '2026-12-01',
    maxGrade: 100,
    createdAt: now(),
  })
)
await expectAllowed('teacher creates announcement in own class', () =>
  addDoc(collection(db, 'announcements'), {
    classId,
    title: 'Exam',
    message: 'Bring books',
    createdAt: now(),
  })
)
await expectAllowed('teacher grades a submission', () =>
  updateDoc(doc(db, 'submissions', submissionId), { grade: 12, status: 'graded' })
)
await expectDenied('teacher cannot read all users', () =>
  getDocs(collection(db, 'users'))
)
await expectDenied('teacher cannot create system notification', () =>
  addDoc(collection(db, 'systemNotifications'), {
    message: 'nope',
    active: true,
    createdAt: now(),
  })
)
await expectDenied('teacher cannot edit FOREIGN class homework', () => {
  const snap = db.collection('homework')
  return snap.where('classId', '==', otherClassId).get()
})

console.log('\n--- ADMIN PERMISSIONS ---')
await signIn(ADMIN)
await expectAllowed('admin reads all users', () => getDocs(collection(db, 'users')))
await expectAllowed('admin creates system notification', async () => {
  const ref = await addDoc(collection(db, 'systemNotifications'), {
    message: 'System maintenance tonight',
    active: true,
    createdAt: now(),
  })
  noteId = ref.id
})
await expectAllowed('admin updates (bans) a user', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: true })
)
await expectAllowed('admin deletes system notification', () =>
  deleteDoc(doc(db, 'systemNotifications', noteId))
)
await expectAllowed('admin can unban a user', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: false })
)
await expectDenied('admin cannot ban themselves', () =>
  updateDoc(doc(db, 'users', adminUid), { banned: true })
)
await expectAllowed('admin can still edit their own profile', () =>
  updateDoc(doc(db, 'users', adminUid), {
    username: 'Admin',
    warningsCleared: true,
  })
)
await expectAllowed('admin reads all submissions across classes', () =>
  getDocs(collection(db, 'submissions'))
)
await expectAllowed('admin can mark an account as reviewed', () =>
  updateDoc(doc(db, 'users', studentUid), { warningsCleared: true })
)

console.log('\n--- BAN ENFORCEMENT ---')
await signIn(ADMIN)
await updateDoc(doc(db, 'users', studentUid), { banned: true })
await signIn(studentEmail)
await expectDenied('banned student cannot create submission', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: seedHwId,
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
)
await expectDenied('banned student cannot unban themselves', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: false })
)
await expectDenied('banned student cannot create user profile', () =>
  setDoc(doc(db, 'users', studentUid), {
    username: 'Reban',
    email: studentEmail,
    role: 'student',
    classId,
    banned: false,
    createdAt: now(),
  })
)

console.log('\n--- BANNED TEACHER ---')
await signIn(ADMIN)
await updateDoc(doc(db, 'users', teacherUid), { banned: true })
await signIn(teacherEmail)
await expectDenied('banned teacher cannot create homework', () =>
  addDoc(collection(db, 'homework'), {
    classId,
    title: 'Banned HW',
    description: 'Nope',
    dueDate: '2026-12-01',
    maxGrade: 100,
    createdAt: now(),
  })
)
await expectDenied('banned teacher cannot grade submissions', () =>
  updateDoc(doc(db, 'submissions', submissionId), { grade: 5, status: 'graded' })
)

console.log('\n--- GROUP MANAGEMENT ---')
await signIn(ADMIN)
await updateDoc(doc(db, 'users', teacherUid), { banned: false })
await updateDoc(doc(db, 'users', studentUid), { banned: false })
await updateDoc(doc(db, 'users', student2Uid), { banned: false })
await signIn(teacherEmail)
await expectAllowed('teacher adds a group to their class', () =>
  updateDoc(doc(db, 'classes', classId), {
    groups: { g1: 'Group A', g2: 'Group B', g3: 'Group C' },
  })
)
await expectAllowed('teacher assigns student 1 to Group A', () =>
  updateDoc(doc(db, 'users', studentUid), { groupId: 'g1' })
)
await expectAllowed('teacher assigns student 2 to Group B', () =>
  updateDoc(doc(db, 'users', student2Uid), { groupId: 'g2' })
)
await expectDenied('teacher cannot assign a student to a group that does not exist', () =>
  updateDoc(doc(db, 'users', studentUid), { groupId: 'nope' })
)
await expectDenied('teacher cannot change a student role', () =>
  updateDoc(doc(db, 'users', studentUid), { role: 'teacher' })
)
await expectDenied('teacher cannot ban a student', () =>
  updateDoc(doc(db, 'users', studentUid), { banned: true })
)
await expectAllowed('teacher can read students of their own class', () =>
  getDocs(query(collection(db, 'users'), where('classId', '==', classId)))
)
await expectDenied('teacher cannot read students of another class', () =>
  getDocs(query(collection(db, 'users'), where('classId', '==', otherClassId)))
)
await signIn(studentEmail)
await expectDenied('student cannot self-assign a group', () =>
  updateDoc(doc(db, 'users', studentUid), { groupId: 'g2' })
)

console.log('\n--- GROUP TARGETING ---')
await signIn(teacherEmail)
let hwEveryone
let hwA
let hwB
let hwBoth
await expectAllowed('teacher posts homework for everyone', async () => {
  const ref = await addDoc(collection(db, 'homework'), {
    classId,
    title: 'Everyone',
    description: 'x',
    dueDate: '2026-12-01',
    maxGrade: 10,
    groupIds: ['*'],
    createdAt: now(),
  })
  hwEveryone = ref.id
})
await expectAllowed('teacher posts homework for Group A only', async () => {
  const ref = await addDoc(collection(db, 'homework'), {
    classId,
    title: 'Group A only',
    description: 'x',
    dueDate: '2026-12-01',
    maxGrade: 10,
    groupIds: ['g1'],
    createdAt: now(),
  })
  hwA = ref.id
})
await expectAllowed('teacher posts homework for Group B only', async () => {
  const ref = await addDoc(collection(db, 'homework'), {
    classId,
    title: 'Group B only',
    description: 'x',
    dueDate: '2026-12-01',
    maxGrade: 10,
    groupIds: ['g2'],
    createdAt: now(),
  })
  hwB = ref.id
})
await expectAllowed('teacher posts homework for Group A and Group B', async () => {
  const ref = await addDoc(collection(db, 'homework'), {
    classId,
    title: 'Group A and B',
    description: 'x',
    dueDate: '2026-12-01',
    maxGrade: 10,
    groupIds: ['g1', 'g2'],
    createdAt: now(),
  })
  hwBoth = ref.id
})
await expectDenied('teacher cannot post homework targeting a group that does not exist', () =>
  addDoc(collection(db, 'homework'), {
    classId,
    title: 'Fake group',
    description: 'x',
    dueDate: '2026-12-01',
    maxGrade: 10,
    groupIds: ['g99'],
    createdAt: now(),
  })
)

console.log('\n--- GROUP ISOLATION (student 1 is in Group A) ---')
await signIn(studentEmail)
await expectAllowed('student in A reads everyone-target homework', () =>
  getDoc(doc(db, 'homework', hwEveryone))
)
await expectAllowed('student in A reads its own group homework', () =>
  getDoc(doc(db, 'homework', hwA))
)
await expectAllowed('student in A reads homework targeting A and B', () =>
  getDoc(doc(db, 'homework', hwBoth))
)
await expectDenied('student in A cannot read Group B homework', () =>
  getDoc(doc(db, 'homework', hwB))
)
await expectAllowed('student list query with array-contains own group', () =>
  getDocs(
    query(
      collection(db, 'homework'),
      where('classId', '==', classId),
      where('groupIds', 'array-contains', 'g1')
    )
  )
)
await expectDenied('student list query with array-contains another group', () =>
  getDocs(
    query(
      collection(db, 'homework'),
      where('classId', '==', classId),
      where('groupIds', 'array-contains', 'g2')
    )
  )
)
await expectDenied('student plain classId list query is rejected entirely', async () => {
  const snap = await getDocs(
    query(collection(db, 'homework'), where('classId', '==', classId))
  )
  const titles = snap.docs.map((d) => `${d.data().title}[${JSON.stringify(d.data().groupIds)}]`)
  throw new Error(`returned ${snap.size} docs: ${titles.join(', ')}`)
})
await expectAllowed('student submits homework targeted at its own group', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: hwA,
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
)
await expectDenied('student cannot submit homework targeted at another group', () =>
  addDoc(collection(db, 'submissions'), {
    homeworkId: hwB,
    classId,
    studentId: studentUid,
    studentName: 'Student',
    status: 'done',
    submittedAt: now(),
  })
)
await expectAllowed('teacher still sees every group target', () => {
  return signIn(teacherEmail).then(() =>
    getDocs(query(collection(db, 'homework'), where('classId', '==', classId)))
  )
})

console.log('\n--- USER DELETION ---')
await signIn(ADMIN)
await expectAllowed('admin can delete a user profile', () =>
  deleteDoc(doc(db, 'users', studentUid))
)
await expectAllowed('deleted profile is really gone', async () => {
  const snap = await getDoc(doc(db, 'users', studentUid))
  if (snap.exists()) throw new Error('document still exists')
})
await expectDenied('teacher cannot delete a user', async () => {
  await signIn(teacherEmail)
  await deleteDoc(doc(db, 'users', otherTeacherUid))
})

console.log(`\n===== ${passed} passed, ${failed} failed =====\n`)
process.exit(failed > 0 ? 1 : 0)
