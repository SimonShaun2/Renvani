import { BookingManageClient } from "@/src/components/booking/BookingManageClient";

export default async function PublicBookingManagePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center text-sm text-neutral-600">
        Missing manage link. Use the link from your confirmation email or booking summary.
      </div>
    );
  }

  return <BookingManageClient slug={slug} manageToken={token} />;
}
