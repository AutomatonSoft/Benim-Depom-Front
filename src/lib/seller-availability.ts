import type { SellerNotification } from "@/lib/seller";

export type AvailabilityResponseState = "pending" | "answered" | "none";
export type AvailabilityAnswerDisplayState = "pending" | "available" | "unavailable" | "unknown" | "none";

export function availabilityAnswerDisplayState(
  notification: Pick<SellerNotification, "notification_type" | "product_id">,
  responseState: AvailabilityResponseState,
  savedAnswer?: boolean,
): AvailabilityAnswerDisplayState {
  if (notification.notification_type !== "product_availability_reminder" || !notification.product_id) return "none";
  if (responseState === "pending") return "pending";
  if (responseState !== "answered" || savedAnswer === undefined) return "unknown";
  return savedAnswer ? "available" : "unavailable";
}


export function availabilityResponseState(notification: Pick<SellerNotification, "notification_type" | "product_id" | "responded_at">, locallyAnswered = false): AvailabilityResponseState {
  if (notification.notification_type !== "product_availability_reminder" || !notification.product_id) return "none";
  return notification.responded_at || locallyAnswered ? "answered" : "pending";
}

function isDefiniteFailure(error: unknown) {
  return !!error && typeof error === "object" && "status" in error
    && typeof error.status === "number" && error.status >= 400 && error.status < 500;
}

export class SellerAvailabilityGuard {
  readonly inFlight = new Set<number>();
  readonly answered = new Set<number>();
  readonly uncertain = new Set<number>();

  isBlocked(productId: number, notificationId = productId) {
    return this.inFlight.has(productId) || this.answered.has(notificationId) || this.uncertain.has(productId);
  }

  async submit(productId: number, send: () => Promise<unknown>, notificationId = productId) {
    if (this.isBlocked(productId, notificationId)) return false;
    this.inFlight.add(productId);
    try {
      await send();
      this.answered.add(notificationId);
      return true;
    } catch (error) {
      if (!isDefiniteFailure(error)) this.uncertain.add(productId);
      throw error;
    } finally {
      this.inFlight.delete(productId);
    }
  }

  resolveUncertain(productId: number) {
    this.uncertain.delete(productId);
  }
}

export async function answerAvailabilityOnce({
  guard, productId, notificationId, send, markRead, onAnswered, onReadError,
}: {
  guard: SellerAvailabilityGuard;
  productId: number;
  notificationId?: number;
  send: () => Promise<unknown>;
  markRead: () => Promise<unknown>;
  onAnswered: () => void;
  onReadError: (error: unknown) => void;
}) {
  const sent = await guard.submit(productId, send, notificationId);
  if (!sent) return false;
  onAnswered();
  try { await markRead(); } catch (error) { onReadError(error); }
  return true;
}
