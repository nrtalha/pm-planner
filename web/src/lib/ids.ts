/** Short random id for rows created in the browser (the API accepts up to 64 characters). */
export function newRowId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
