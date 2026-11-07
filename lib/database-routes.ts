/** Fixed static route: runtime-created IDs cannot be dynamic export paths. */
export function databaseHref(id: string, tab = ""): string {
  const query = new URLSearchParams({ db: id });
  if (tab) query.set("tab", tab);
  return `/databases/manage?${query.toString()}`;
}
