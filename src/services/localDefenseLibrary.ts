/** Device-only defense Q&A storage; never sync responses or audio to SpeakLab servers. */
export function defenseStorageKey(ownerSub: string, sessionId: string): string {
  return 'speaklab_defense_practice_v1:' + ownerSub + ':' + sessionId;
}

export function deleteLocalDefensePractice(sessionId: string, ownerSub: string): void {
  if (typeof window === 'undefined') return;
  if (!/^ses_[\w-]{5,100}$/u.test(sessionId) ||
      !(ownerSub === 'guest' || /^[0-9]{5,64}$/u.test(ownerSub))) return;
  try { window.localStorage.removeItem(defenseStorageKey(ownerSub, sessionId)); }
  catch { /* Browser storage can be disabled. */ }
}
