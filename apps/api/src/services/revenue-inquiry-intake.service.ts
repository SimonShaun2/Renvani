import { and, eq, gte, isNull } from "drizzle-orm";

import { bookingRequests, customers, db, emitEvent, inquirySubmitIdempotency } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type InboxInquiryIntakeInput,
  type InquiryAttributionProvenance,
  type InquiryIntakeV1,
  type InquiryServiceability,
  type PublicInquirySubmitResult,
  type StaffInquiryIntakeInput,
  type SubmitBookingRequestInput,
  readEmergencyServiceSettings,
  resolveEmergencyRequest
} from "@fsm/types";

import {
  checkZipCoverage,
  createCompanyScopedInquiryBooking,
  getPublicBookingCompany,
  resolvePublicBookingCompanyId,
  submitBookingRequest
} from "./booking.service.js";
import {
  buildInquiryDedupeKey,
  classifyFromBookingRow,
  classifyInquiryIntent,
  hashInquirySubmitPayload,
  mapBookingRowToInquiryIntakeV1,
  resolveAmbiguityEscalation,
  type IntakeBuildContext
} from "./revenue-inquiry-intake.logic.js";

export {
  buildInquiryDedupeKey,
  classifyInquiryIntent,
  hashInquirySubmitPayload,
  mapBookingRowToInquiryIntakeV1
} from "./revenue-inquiry-intake.logic.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUPE_WINDOW_MS = 60 * 1000;

type BookingRequestRow = typeof bookingRequests.$inferSelect;

async function findRecentDuplicateRow(
  companyId: string,
  phone: string,
  email: string | null,
  excludeBookingRequestId?: string
): Promise<BookingRequestRow | null> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const rows = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, companyId),
        eq(bookingRequests.phone, phone),
        gte(bookingRequests.createdAt, since),
        isNull(bookingRequests.deletedAt)
      )
    );

  const candidates = rows
    .filter((row) => (excludeBookingRequestId ? row.id !== excludeBookingRequestId : true))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 10);

  if (candidates.length === 0) {
    return null;
  }

  if (!email) {
    return candidates[0] ?? null;
  }

  return candidates.find((row) => row.email === email) ?? candidates[0] ?? null;
}

async function loadIdempotencyRecord(companyId: string, idempotencyKey: string) {
  const [record] = await db
    .select()
    .from(inquirySubmitIdempotency)
    .where(
      and(
        eq(inquirySubmitIdempotency.companyId, companyId),
        eq(inquirySubmitIdempotency.idempotencyKey, idempotencyKey),
        isNull(inquirySubmitIdempotency.deletedAt)
      )
    )
    .limit(1);

  return record ?? null;
}

async function persistIdempotencyRecord(input: {
  companyId: string;
  idempotencyKey: string;
  payloadHash: string;
  bookingRequestId: string;
  responseSnapshot: PublicInquirySubmitResult;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
  await db.insert(inquirySubmitIdempotency).values({
    companyId: input.companyId,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
    bookingRequestId: input.bookingRequestId,
    responseSnapshot: input.responseSnapshot,
    expiresAt
  });
}

async function emitInquiryLifecycleEvents(
  inquiry: InquiryIntakeV1,
  actor: { id?: string; type: "user" | "system" | "customer"; name?: string }
): Promise<void> {
  await emitEvent({
    companyId: inquiry.companyId,
    eventType: "revenue.inquiry_received",
    actorId: actor.id,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "booking_request",
    entityId: inquiry.linkedBookingRequestId ?? inquiry.id,
    customerId: inquiry.linkedCustomerId,
    payload: {
      channel: inquiry.channel,
      sourceAttribution: inquiry.sourceAttribution,
      attributionProvenance: inquiry.attributionProvenance,
      classifiedIntent: inquiry.classifiedIntent,
      status: inquiry.status,
      dedupeKey: inquiry.dedupeKey
    },
    summary: `Revenue inquiry received (${inquiry.channel})`
  });

  if (inquiry.status === "escalated") {
    await emitEvent({
      companyId: inquiry.companyId,
      eventType: "revenue.inquiry_escalated",
      actorId: actor.id,
      actorType: actor.type,
      actorName: actor.name,
      entityType: "booking_request",
      entityId: inquiry.linkedBookingRequestId ?? inquiry.id,
      customerId: inquiry.linkedCustomerId,
      payload: {
        escalationReason: inquiry.escalationReason,
        classifiedIntent: inquiry.classifiedIntent
      },
      summary: `Revenue inquiry escalated: ${inquiry.escalationReason ?? "ambiguous"}`
    });
  }
}

async function buildInquiryFromRow(
  row: BookingRequestRow,
  baseContext: Omit<IntakeBuildContext, "classifiedIntent" | "status" | "dedupeKey" | "escalationReason">,
  priorDuplicate: BookingRequestRow | null,
  linkedCustomerId?: string
): Promise<InquiryIntakeV1> {
  const classifiedIntent = classifyFromBookingRow(row);

  const priorIntent = priorDuplicate ? classifyFromBookingRow(priorDuplicate) : null;

  const escalation = resolveAmbiguityEscalation(classifiedIntent, priorIntent);
  const dedupeKey =
    priorDuplicate && priorDuplicate.id !== row.id
      ? buildInquiryDedupeKey(row.companyId, row.phone, row.email)
      : undefined;

  return mapBookingRowToInquiryIntakeV1(row, {
    ...baseContext,
    classifiedIntent,
    status: escalation.status,
    ...(dedupeKey ? { dedupeKey } : {}),
    ...(escalation.escalationReason ? { escalationReason: escalation.escalationReason } : {}),
    ...(linkedCustomerId ? { linkedCustomerId } : {})
  });
}

function companyTrade(settings: unknown): string | null {
  const trade = settings && typeof settings === "object" ? (settings as Record<string, unknown>).trade : null;
  return typeof trade === "string" ? trade : null;
}

export async function submitPublicInquiryIntake(
  slug: string,
  body: SubmitBookingRequestInput,
  sourceParam: string | undefined,
  idempotencyKey: string | undefined
): Promise<{ created: boolean; result: PublicInquirySubmitResult }> {
  const coverage = await checkZipCoverage(slug, body.zip);
  const serviceability: InquiryServiceability = coverage.covered ? "in_area" : "out_of_area";

  const payloadForHash = {
    slug,
    body,
    src: sourceParam ?? body.source ?? null
  };
  const payloadHash = hashInquirySubmitPayload(payloadForHash);

  const companyId = await resolvePublicBookingCompanyId(slug);

  if (idempotencyKey) {
    const existing = await loadIdempotencyRecord(companyId, idempotencyKey);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new AppError(ErrorCode.CONFLICT, "Idempotency key was already used with a different payload", {
          reason: "idempotency_payload_mismatch"
        });
      }

      const snapshot = existing.responseSnapshot as PublicInquirySubmitResult;
      return { created: false, result: snapshot };
    }
  }

  // 24/7 emergency: accepted only when the shop has emergency service on (and its trade is emergency-capable);
  // otherwise downgraded to a normal request and reported back as `emergency.downgraded` (never rejected).
  const shopSettings = (await getPublicBookingCompany(slug)).settings;
  const emergency = resolveEmergencyRequest(
    body.emergency === true,
    readEmergencyServiceSettings(shopSettings),
    companyTrade(shopSettings)
  );
  const { emergency: _emergencyFlag, ...bookingBody } = body;
  const effectiveBody: SubmitBookingRequestInput = emergency.accepted
    ? { ...bookingBody, urgency: "emergency" }
    : emergency.downgraded && bookingBody.urgency === "emergency"
      ? { ...bookingBody, urgency: "this_week" }
      : bookingBody;
  const submitResult = await submitBookingRequest(slug, effectiveBody, sourceParam);
  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.id, submitResult.bookingRequest.id),
        eq(bookingRequests.companyId, submitResult.bookingRequest.companyId),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Inquiry booking row missing after submit");
  }

  const priorDuplicate = await findRecentDuplicateRow(row.companyId, row.phone, row.email, row.id);
  const sourceAttribution = row.source;
  const inquiry = await buildInquiryFromRow(
    row,
    {
      channel: "web_form",
      attributionProvenance: sourceParam || body.source ? "query_param" : "unknown",
      sourceAttribution,
      captureSurface: "book/confirm",
      serviceability
    },
    priorDuplicate,
    row.customerId ?? undefined
  );

  await emitInquiryLifecycleEvents(inquiry, { type: "customer", name: `${row.firstName} ${row.lastName}` });

  const result: PublicInquirySubmitResult = {
    bookingRequest: {
      id: submitResult.bookingRequest.id,
      referenceNumber: submitResult.bookingRequest.referenceNumber,
      status: submitResult.bookingRequest.status
    },
    confirmation: submitResult.confirmation,
    holdToken: submitResult.holdToken,
    inquiry,
    ...(emergency.requested ? { emergency } : {})
  };

  if (idempotencyKey) {
    await persistIdempotencyRecord({
      companyId: row.companyId,
      idempotencyKey,
      payloadHash,
      bookingRequestId: row.id,
      responseSnapshot: result
    });
  }

  return { created: true, result };
}

export async function intakeStaffInquiry(
  companyId: string,
  actorId: string,
  input: StaffInquiryIntakeInput
): Promise<InquiryIntakeV1> {
  const property = input.property ?? {};
  const addressLine1 = property.addressLine1?.trim() || "Address pending";
  const city = property.city?.trim() || "Pending";
  const state = property.state?.trim() || "XX";
  const zip = property.zip?.trim() || "00000";

  const { bookingRequest, customerId } = await createCompanyScopedInquiryBooking(
    companyId,
    {
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
      phone: input.contact.phone,
      email: input.contact.email ?? null,
      addressLine1,
      city,
      state,
      zip,
      customerNotes: input.intentText,
      source: input.sourceAttribution ?? "direct",
      ...(input.smsConsentAppointments !== undefined
        ? { smsConsentAppointments: input.smsConsentAppointments }
        : {}),
      ...(input.smsConsentMarketing !== undefined ? { smsConsentMarketing: input.smsConsentMarketing } : {})
    },
    { id: actorId, type: "user", name: "Staff intake" }
  );

  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(and(eq(bookingRequests.id, bookingRequest.id), eq(bookingRequests.companyId, companyId)))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Inquiry not found after intake");
  }

  const priorDuplicate = await findRecentDuplicateRow(companyId, row.phone, row.email, row.id);
  const inquiry = await buildInquiryFromRow(
    row,
    {
      channel: input.channel,
      attributionProvenance: input.attributionProvenance ?? "staff_entry",
      sourceAttribution: input.sourceAttribution ?? "direct",
      captureSurface: "staff_modal",
      serviceability: zip === "00000" ? "unknown" : "in_area"
    },
    priorDuplicate,
    customerId
  );

  await emitInquiryLifecycleEvents(inquiry, { id: actorId, type: "user", name: "Staff intake" });
  return inquiry;
}

export async function intakeInboxInquiry(
  companyId: string,
  actorId: string,
  input: InboxInquiryIntakeInput
): Promise<InquiryIntakeV1> {
  const inboxKey = `inbox:${input.inboxChannel}:${input.externalMessageId}`;
  const existing = await loadIdempotencyRecord(companyId, inboxKey);
  if (existing) {
    const snapshot = existing.responseSnapshot as { inquiry: InquiryIntakeV1 };
    return snapshot.inquiry;
  }

  const phoneMatch = input.inboxChannel === "sms" ? input.fromAddress : null;
  const emailMatch = input.inboxChannel === "email" ? input.fromAddress : null;
  const nameParts = input.fromAddress.split("@")[0]?.split(/[.<_]/u) ?? ["Inbox"];
  const firstName = nameParts[0] ?? "Inbox";
  const lastName = nameParts[1] ?? "Lead";

  const attributionProvenance: InquiryAttributionProvenance =
    input.adapterAttributionVerified && input.adapterAttribution ? "adapter_signed" : "unknown";

  const { bookingRequest, customerId } = await createCompanyScopedInquiryBooking(
    companyId,
    {
      firstName,
      lastName,
      phone: phoneMatch ?? "",
      email: emailMatch,
      addressLine1: "Inbox intake",
      city: "Pending",
      state: "XX",
      zip: "00000",
      customerNotes: input.subject ? `${input.subject}\n\n${input.bodyText}` : input.bodyText,
      source: input.adapterAttribution ?? "direct"
    },
    { id: actorId, type: "user", name: "Inbox adapter" }
  );

  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(and(eq(bookingRequests.id, bookingRequest.id), eq(bookingRequests.companyId, companyId)))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Inquiry not found after inbox intake");
  }

  const priorDuplicate = await findRecentDuplicateRow(companyId, row.phone, row.email, row.id);
  const inquiry = await buildInquiryFromRow(
    row,
    {
      channel: "adapter",
      attributionProvenance,
      sourceAttribution: input.adapterAttribution ?? null,
      captureSurface: `inbox/${input.inboxChannel}`,
      serviceability: "unknown"
    },
    priorDuplicate,
    customerId
  );

  await emitInquiryLifecycleEvents(inquiry, { id: actorId, type: "user", name: "Inbox adapter" });

  await persistIdempotencyRecord({
    companyId,
    idempotencyKey: inboxKey,
    payloadHash: hashInquirySubmitPayload({ companyId, ...input }),
    bookingRequestId: row.id,
    responseSnapshot: {
      bookingRequest: {
        id: bookingRequest.id,
        referenceNumber: bookingRequest.referenceNumber,
        status: bookingRequest.status
      },
      confirmation: null,
      holdToken: null,
      inquiry
    }
  });

  return inquiry;
}

/**
 * Growth — public service-by-ZIP page inquiry (no address). Reuses the FS-17 company-scoped inquiry booking
 * (customer match/create + booking_requests row + booking.requested event) and the revenue inquiry lifecycle
 * events. booking_requests.source is a closed enum without "service_page", so the row is stored as "website" and
 * the precise lead source goes on customers.lead_source (varchar, only when unset) and the inquiry attribution.
 */
export async function intakeServicePageInquiry(
  companyId: string,
  input: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    zip: string;
    customerNotes: string | null;
    leadSource: string;
    serviceability: InquiryServiceability;
  }
): Promise<{ referenceNumber: string; inquiry: InquiryIntakeV1 }> {
  const actorName = `${input.firstName} ${input.lastName}`.trim();
  const { bookingRequest, customerId } = await createCompanyScopedInquiryBooking(
    companyId,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      addressLine1: "Not provided (service page inquiry)",
      city: "Pending",
      state: "XX",
      zip: input.zip,
      customerNotes: input.customerNotes,
      source: "website"
    },
    { id: null, type: "customer", name: actorName }
  );

  await db
    .update(customers)
    .set({ leadSource: input.leadSource })
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId), isNull(customers.leadSource)));

  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(and(eq(bookingRequests.id, bookingRequest.id), eq(bookingRequests.companyId, companyId)))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Inquiry booking row missing after service page intake");
  }

  const priorDuplicate = await findRecentDuplicateRow(companyId, row.phone, row.email, row.id);
  const inquiry = await buildInquiryFromRow(
    row,
    {
      channel: "web_form",
      attributionProvenance: "query_param",
      sourceAttribution: input.leadSource,
      captureSurface: "site/service_page",
      serviceability: input.serviceability
    },
    priorDuplicate,
    customerId
  );

  await emitInquiryLifecycleEvents(inquiry, { type: "customer", name: actorName });
  return { referenceNumber: bookingRequest.referenceNumber ?? bookingRequest.id, inquiry };
}

export async function getInquiryIntakeForBookingRequest(
  companyId: string,
  bookingRequestId: string
): Promise<InquiryIntakeV1> {
  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, companyId),
        eq(bookingRequests.id, bookingRequestId),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Inquiry not found");
  }

  return buildInquiryFromRow(
    row,
    {
      channel: "web_form",
      attributionProvenance: "unknown",
      sourceAttribution: row.source,
      captureSurface: "read_model",
      serviceability: "unknown"
    },
    null,
    row.customerId ?? undefined
  );
}
