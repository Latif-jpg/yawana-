export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return 'Inconnu';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return "À l'instant";
  if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
  if (diffInHours < 24) return `Il y a ${diffInHours} h`;
  if (diffInDays === 1) return 'Hier';
  
  return `Il y a ${diffInDays} j`;
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}
