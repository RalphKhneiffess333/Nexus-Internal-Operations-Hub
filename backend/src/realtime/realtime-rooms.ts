export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function ticketRoom(ticketId: string): string {
  return `ticket:${ticketId}`;
}

export function chatRoom(ticketId: string): string {
  return `chat:${ticketId}`;
}
