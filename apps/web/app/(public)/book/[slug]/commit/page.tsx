import { BookingSlotCommitClient } from "@/src/components/booking/BookingSlotCommitClient";

export default async function PublicBookingCommitPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <BookingSlotCommitClient slug={slug} />;
}
