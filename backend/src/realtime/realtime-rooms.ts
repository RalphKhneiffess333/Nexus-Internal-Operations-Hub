export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function ticketRoom(ticketId: string): string {
  return `ticket:${ticketId}`;
}
