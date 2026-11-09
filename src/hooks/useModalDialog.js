import { useEffect } from 'react'

let locks = 0
let previousBodyOverflow = ''
let previousRootOverflow = ''

export default function useModalDialog(ref) {
  useEffect(() => {
    const dialog = ref.current
    const previousFocus = document.activeElement
    dialog.showModal()
    if (locks === 0) {
      previousBodyOverflow = document.body.style.overflow
      previousRootOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }
    locks += 1
    return () => {
      dialog.close()
      locks -= 1
      if (locks === 0) {
        document.body.style.overflow = previousBodyOverflow
        document.documentElement.style.overflow = previousRootOverflow
      }
      const activeDialog = document.querySelector('dialog:modal')
      if (previousFocus?.isConnected && (!activeDialog || activeDialog.contains(previousFocus))) previousFocus.focus({ preventScroll: true })
    }
  }, [ref])
}
