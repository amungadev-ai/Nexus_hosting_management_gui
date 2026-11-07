/** Fixed static route: runtime-created IDs cannot be dynamic export paths. */
export function jobHref(id: string): string {
  return `/activity/jobs?op=${encodeURIComponent(id)}`;
}
