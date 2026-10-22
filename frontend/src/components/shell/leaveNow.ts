const EXIT_URL = 'https://www.google.com/'

/**
 * Leaves at once for a neutral page. location.replace swaps this page out of the history
 * entry, so Back does not return to the form. Esc does the same on the reporter portal.
 */
export function leaveNow(): void {
  window.location.replace(EXIT_URL)
}
