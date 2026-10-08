export type InteractionNotificationType = "repost" | "save";
export type InteractionTargetType = "post" | "public_deck";

export function interactionNotificationKey(actorId: string, type: InteractionNotificationType, targetType: InteractionTargetType, targetId: string) {
  return `${type}:${actorId}:${targetType}:${targetId}`;
}

export function interactionNotificationCopy(actorName: string, type: InteractionNotificationType, targetType: InteractionTargetType) {
  const targetLabel = targetType === "post" ? "post" : "deck";
  const action = type === "repost" ? "me-repost" : "menyimpan";
  return `${actorName} ${action} ${targetLabel} kamu`;
}

export function shouldCreateInteractionNotification(ownerId: string, actorId: string) {
  return ownerId !== actorId;
}
