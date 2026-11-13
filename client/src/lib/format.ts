const percentFormat = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});

const countFormat = new Intl.NumberFormat("en-GB");

// UTC on both sides so no viewer time zone can shift the day.
const releaseDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** Seller rating in basis points (9850) as a percent ("98.5%"). */
export function formatRating(basisPoints: number): string {
  return percentFormat.format(basisPoints / 10000);
}

export function formatCount(count: number): string {
  return countFormat.format(count);
}

/** An API date ("2015-05-18") as "18 May 2015". */
export function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return releaseDateFormat.format(Date.UTC(year, month - 1, day));
}

/** "1 second" or "N seconds", for 429 retry messages. */
export function secondsText(seconds: number): string {
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}
