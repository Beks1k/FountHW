import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useConfirm } from '../components/FeedbackProvider'

export default function useSignOut() {
  const confirm = useConfirm()

  return async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will need your email and password to sign back in.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      danger: false,
    })
    if (ok) {
      await signOut(auth)
    }
  }
}
