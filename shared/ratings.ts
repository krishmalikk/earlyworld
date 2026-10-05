/** Store half-stars as integers so aggregates never accumulate floating-point error. */
export type RatingValue = {
  uid: string;
  trackId: string;
  halfStars: number;
  review: string;
};
export const REVIEW_LIMIT = 500;
export function validHalfStars(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}
export function averageRating(count = 0, halfStarSum = 0): string | null {
  return count > 0 ? (halfStarSum / (2 * count)).toFixed(1) : null;
}
export function ratingLabel(halfStars: number): string {
  return `${halfStars / 2} out of 5 stars`;
}
