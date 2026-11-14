import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const linkError = (code) => Object.assign(new Error(code), { code })

export function linkErrorMessage(err) {
  switch (err?.code) {
    case 'link/bad-pin':
      return 'The PIN must be exactly 6 digits.'
    case 'link/no-name':
      return "Enter your child's username."
    case 'link/invalid-pin':
      return 'No student has that PIN. Check it with your child and try again.'
    case 'link/mismatch':
      return "The PIN and the child's username do not match. Check both and try again."
    default:
      return null
  }
}

// Parent side: link a child using the child's PIN and username.
// Returns the child's user id.
export async function linkChild(db, parentUid, pin, childUsername) {
  const cleanPin = String(pin).trim()
  const name = String(childUsername).trim()
  if (!/^\d{6}$/.test(cleanPin)) throw linkError('link/bad-pin')
  if (!name) throw linkError('link/no-name')

  const snap = await getDoc(doc(db, 'parentLinks', cleanPin))
  if (!snap.exists()) throw linkError('link/invalid-pin')
  const { studentId, classId } = snap.data()

  try {
    await setDoc(doc(db, 'parentChildren', `${parentUid}_${studentId}`), {
      parentId: parentUid,
      studentId,
      classId,
      pin: cleanPin,
      studentUsername: name,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    if (err?.code === 'permission-denied') throw linkError('link/mismatch')
    throw err
  }

  await setDoc(doc(db, 'parentClasses', `${parentUid}_${classId}`), {
    parentId: parentUid,
    studentId,
    classId,
  })

  return studentId
}

function randomPin() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]
  return String(100000 + (n % 900000))
}

// Student side: create this student's permanent parent PIN.
export async function createParentPin(db, uid, classId) {
  for (let i = 0; i < 8; i++) {
    const pin = randomPin()
    try {
      await setDoc(doc(db, 'parentLinks', pin), {
        studentId: uid,
        classId,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      if (err?.code === 'permission-denied') continue // PIN already taken
      throw err
    }
    await updateDoc(doc(db, 'users', uid), { parentPin: pin })
    return pin
  }
  throw new Error('parent-pin-failed')
}