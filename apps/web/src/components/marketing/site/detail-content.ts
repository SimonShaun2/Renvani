/** Page-specific editorial content only. Product names, offerings and navigation remain in the approved registry. */
export type DetailFeature = { label: string; title: string; body: string; points: readonly string[]; visual: string; part: number };
const feature = (label: string, title: string, body: string, points: string, visual: string, part = 0): DetailFeature => ({ label, title, body, points: points.split("|"), visual, part });
export const DETAIL_FEATURES: Record<string, readonly DetailFeature[]> = {
  "scheduling-dispatch": [
    feature("See the day", "A full schedule. A clearer picture.", "See the visits on the board before the phone starts ringing. Bring the job, assigned technician and service window into one view, so the office can plan around the work already booked.", "Review technician availability|Keep job details beside the assignment|See the next visit in context", "scheduling-dispatch"),
    feature("Make the right assignment", "Send the context, not just the address.", "An approved estimate should arrive with the job. Give the technician the scope, customer details and property information they need without rebuilding the story over a phone call.", "Carry approved scope into the work order|Keep customer and property details together|Make the next action clear", "jobs-work-orders"),
    feature("Keep the field connected", "When the day changes, keep everyone aligned.", "Keep the visit and its latest details in the technician’s workflow. The office and field can work from the same record instead of chasing a separate trail of messages.", "Review the assigned visit|Keep tasks, notes and photos with the job|Carry completion into invoicing", "technician-app")
  ],
  growth: [
    feature("Your business online", "Make the first impression yours.", "Show the work you do and the places you serve on a website that belongs to your business. Give a prospective customer a clear path from learning about a service to requesting it.", "Show your services|Explain your service area|Keep your brand front and center", "websites"),
    feature("Direct demand", "Give interest somewhere to go.", "Let customers tell you what they need without losing the context of their visit. A service request carries its customer details forward for review and the next step.", "Collect the requested service|Capture the property and preferred visit|Keep the request connected", "online-booking"),
    feature("A useful handoff", "Turn a new request into a real conversation.", "Keep the inquiry, source and service together as Revenue prepares the response or estimate. The office starts with context, not an empty customer record.", "Review incoming inquiries|Keep the source with the record|Prepare the next response", "inquiry-response-follow-up")
  ],
  revenue: [
    feature("Inquiry response", "Meet the customer where the conversation starts.", "Bring the service request and customer history into view before preparing a reply. Review the response and next step in the same place as the inquiry.", "See the original request|Keep the conversation connected|Review before sending", "inquiry-response-follow-up"),
    feature("Estimates", "Make the decision easy to understand.", "Present a clear scope using your services and prices. Prepare an email estimate or an onsite assessment, then keep the customer’s approval attached to the work.", "Use your price book|Review pricing exceptions|Record the accepted scope", "estimates-approvals"),
    feature("Approved work", "Keep the promise through the handoff.", "Move the accepted work into the job with the details already attached. Operations gets the scope the customer agreed to, rather than another version typed from memory.", "Connect estimate and job|Keep customer details intact|Prepare the visit for dispatch", "jobs-work-orders")
  ],
  operations: [
    feature("Schedule and dispatch", "Give the whole day a clear plan.", "Bring scheduled work, technician availability and job details together. See what is assigned and what needs attention before sending the team into the field.", "Review today’s visits|Assign with the scope in view|Keep the next job visible", "scheduling-dispatch"),
    feature("In the field", "Put the job in the technician’s hands.", "Give technicians the work record they need onsite. Keep tasks, products, photos and notes attached to the visit as the work happens.", "Review the approved scope|Document the work onsite|Keep job history accessible", "technician-app"),
    feature("Invoice and payment", "Finish with a record the office can use.", "Connect the completed work to the invoice and payment status. The job does not end as a collection of notes that somebody else has to piece together.", "Invoice the completed scope|Review charges before presenting|Keep payment status with the job", "invoices-payments")
  ],
  retention: [
    feature("Customer history", "Remember the work behind the relationship.", "The next conversation should start with what your team already knows. Keep previous visits, property details and equipment history together.", "See the service record|Keep property context|Pick up the conversation", "customers-properties-assets"),
    feature("Ongoing service", "Keep the next visit in view.", "Bring service agreement terms, covered work and upcoming renewal conversations together. Make the relationship more useful than a date on somebody’s calendar.", "Review agreement terms|Connect covered visits|Prepare the renewal conversation", "service-agreements"),
    feature("Thoughtful follow-up", "Reach out with a reason.", "Prepare reminders from the actual service record. Review the timing, customer preferences and proposed message before inviting the customer back.", "Use relevant visit context|Respect consent and review|Make rebooking a clear next step", "reminders-win-backs")
  ],
  "command-center": [
    feature("Business context", "Start with the business you already have.", "Connect customers, properties and service history so decisions have a useful starting point. Your operating profile gives proposed actions boundaries.", "Keep customer context|Review property and asset records|Set the business direction", "customers-properties-assets"),
    feature("Owner decisions", "See the reason behind the next move.", "Review opportunities from the available business records. See the evidence and proposed action before deciding whether to approve, change or hold it.", "Review the source record|Keep exceptions visible|Approve the next action", "ai-revenue-intelligence"),
    feature("Business visibility", "Follow the work, not another spreadsheet.", "Keep recorded sources and job outcomes connected. Use the available evidence to understand what is moving through the business and what still needs attention.", "Follow recorded job sources|Review linked outcomes|Keep missing attribution explicit", "reporting-job-sources")
  ],
  websites: [
    feature("Your brand", "A better front door for your business.", "Show your services and service area in a clear, branded experience. Help visitors understand the work you do before they reach out.", "Present your services|Show where you work|Keep a clear contact path", "websites", 0),
    feature("Service requests", "Make the next click count.", "Connect the service page to a useful request. Capture what the customer needs and where the work is, instead of asking them to repeat everything later.", "Collect service details|Capture the property|Offer a clear request action", "online-booking"),
    feature("Source context", "Know where the conversation began.", "Carry recorded source details into the customer’s inquiry. Give the office context for the reply and a way to follow the request into the job.", "Keep the inquiry source|Connect to the customer record|Follow the work forward", "reporting-job-sources")
  ],
  "online-booking": [
    feature("Service selection", "Let customers start with what they need.", "A focused service request helps customers describe the job. Capture the service and property without sending them through a generic contact form.", "Choose a service|Collect property details|Capture the customer’s request", "online-booking", 0),
    feature("Visit requests", "Keep the requested time with the job.", "Bring the customer’s preferred visit into the office workflow. A request remains a request until the business’s booking rules and confirmation steps are satisfied.", "Record the preferred visit|Review availability|Confirm the next step", "scheduling-dispatch"),
    feature("Response", "Start the conversation with context.", "Carry the request into the inquiry record so your team can prepare the estimate or response without starting over.", "Keep customer details attached|Review the service need|Prepare a relevant reply", "inquiry-response-follow-up")
  ],
  "estimates-approvals": [
    feature("Consistent pricing", "Build from the prices you trust.", "Use your service catalog, labor and materials as the starting point. Keep the proposed scope clear and review exceptions before the estimate reaches the customer.", "Use catalog items|Keep the scope readable|Review the final amount", "price-book-service-catalog"),
    feature("Customer approval", "Give the customer a clear decision.", "Keep proposed work and the customer’s response in one estimate record. Whether the conversation starts by email or onsite, the accepted scope stays visible.", "Present proposed work|Record the customer’s decision|Keep approval with the estimate", "estimates-approvals"),
    feature("The work order", "Carry the yes into the job.", "Connect the accepted estimate to the work order. The team receives the agreed scope, ready to plan and perform the visit.", "Connect estimate and job|Preserve the agreed work|Prepare dispatch", "jobs-work-orders")
  ],
  "technician-app": [
    feature("Before arrival", "Know the job before you get there.", "Bring the customer, property and service history into the visit. The technician gets more than an address and a time slot.", "Review the next visit|See customer and asset context|Read the approved scope", "technician-app", 0),
    feature("During the visit", "Keep the work in one place.", "Track the job and record the details while they are fresh. Tasks, products, notes and photos belong with the work being performed.", "Record job tasks|Keep time and photos together|Look up service and product details", "time-tracking-job-photos"),
    feature("At completion", "Finish the visit with the customer.", "Confirm the completed scope and follow the business’s invoice and payment workflow. Keep the resulting record available to the office.", "Confirm completed work|Review the invoice|Record payment status", "invoices-payments")
  ],
  "invoices-payments": [
    feature("Completed work", "Invoice what actually happened.", "Use the completed work order as the starting point for the invoice. Keep charges connected to the agreed scope and the record of the visit.", "Bring in completed scope|Review service items|Keep the job attached", "jobs-work-orders"),
    feature("Clear charges", "Make the amount easy to understand.", "Present the invoice with service charges and applicable fees clearly separated. Review the amount before the customer makes a payment.", "Review invoice line items|Keep taxes and fees distinct|Present a clear total", "invoices-payments"),
    feature("Payment visibility", "Keep the payment with the job.", "Follow recorded payment status without separating it from the customer and invoice. Your processing and payment controls continue to govern the transaction.", "Review invoice status|Keep payment records linked|Carry context into follow-up", "invoices-payments", 2)
  ],
  "jobs-work-orders": [
    feature("Approved scope", "One version of the work.", "Start the job from the accepted estimate. Keep the scope the customer approved with the record the team uses in the field.", "Connect the accepted estimate|Keep approved service items|Avoid re-entering the scope", "estimates-approvals"),
    feature("Job coordination", "Give the office a shared record.", "Keep the customer, property, assigned team and visit status together. The next person opening the job can see what needs to happen.", "Keep customer and site details|See the assignment|Follow visit status", "jobs-work-orders"),
    feature("Job evidence", "Leave a record worth coming back to.", "Add the notes, time and photos that explain the visit. Keep that evidence ready for invoicing and the customer’s next call.", "Attach job photos|Record work notes|Keep time with the visit", "time-tracking-job-photos")
  ],
  "inquiry-response-follow-up": [
    feature("A connected inbox", "See the request before you reply.", "Keep the customer, requested service and source in view. Give every conversation a clear starting point.", "Read the service request|Review customer context|Keep the source attached", "inquiry-response-follow-up"),
    feature("A useful response", "Move from the question to the scope.", "Prepare the right next step, whether that is an email estimate or an onsite assessment. Review the response before it goes out.", "Prepare the estimate path|Review the draft|Keep the conversation linked", "estimates-approvals"),
    feature("Follow-up", "Know what still needs a response.", "Keep the previous contact and proposed next action connected to the inquiry. Customer communication remains subject to consent and approval.", "Review the last contact|Check recipient and consent|Approve the next message", "inquiry-response-follow-up", 2)
  ],
  "customer-portal": [
    feature("Preview experience", "Put the customer’s next step first.", "The proposed portal brings the relevant visit and customer-facing action together. This page is a preview; confirm availability during your demo.", "Preview visit information|Keep customer context|Review supported actions", "customer-portal"),
    feature("Estimate visibility", "A clearer view of the proposed work.", "The intended experience connects the estimate to the customer’s service journey instead of separating the decision from the job.", "Review proposed scope|See the relevant estimate|Keep the next step clear", "estimates-approvals"),
    feature("Payment context", "Keep the invoice in the conversation.", "Preview how an invoice can sit alongside the work it covers. Supported portal payment and rescheduling actions must be confirmed for your deployment.", "See the related invoice|Keep visit context|Confirm availability in your demo", "invoices-payments")
  ],
  "price-book-service-catalog": [
    feature("Your service list", "Give the team a shared starting point.", "Keep the services and products you sell in one catalog. A consistent description makes it easier to build the next estimate.", "Organize services|Keep product details|Use shared descriptions", "price-book-service-catalog"),
    feature("Estimate building", "Your prices belong in the estimate.", "Bring catalog items into the proposed work instead of recreating them each time. Review the final scope and pricing exceptions before sending.", "Select service items|Include labor and materials|Review the final proposal", "estimates-approvals"),
    feature("Connected work", "Carry the service item into the visit.", "Keep the agreed service and product context with the work order. The office and field can reference the same approved job.", "Preserve service descriptions|Keep the scope connected|Support job documentation", "jobs-work-orders")
  ],
  "time-tracking-job-photos": [
    feature("Job time", "Keep the time with the work.", "Attach recorded time to the visit it belongs to. Give the office a clearer view of what happened without another round of messages.", "Record visit time|Keep entries with the job|Review the completed record", "time-tracking-job-photos"),
    feature("Visual evidence", "Show the details a note can miss.", "Capture job photos while the team is onsite. Keep images with the customer, property and work order they describe.", "Attach relevant photos|Keep before-and-after context|Add supporting job notes", "technician-app"),
    feature("Service history", "Make the next visit easier to understand.", "Carry documentation into the service record. The next technician has context rather than a blank page.", "Keep the work history|Connect property details|Prepare for repeat service", "customers-properties-assets")
  ],
  "service-agreements": [
    feature("Agreement details", "Keep the promise in one place.", "Bring the customer, property and agreement terms into a shared record. Keep the ongoing relationship tied to the services you provide.", "Review covered services|Keep customer context|See agreement terms", "service-agreements"),
    feature("Covered visits", "Connect the agreement to actual service.", "Keep completed work and future service conversations in view. The office can prepare the next visit with the agreement context already available.", "Review previous service|Keep visits connected|Prepare the next appointment", "scheduling-dispatch"),
    feature("Renewals", "Give the next conversation a head start.", "Prepare renewal and maintenance outreach from the existing record. Review the message and timing before reaching out.", "Review renewal context|Respect customer preferences|Make the next request simple", "reminders-win-backs")
  ],
  "reminders-win-backs": [
    feature("Relevant timing", "Start with the service, not a mailing list.", "Use the customer’s visit or agreement history to find a useful reason to reconnect. Keep the reminder tied to actual work.", "Review prior service|Use agreement context|Choose the next touchpoint", "service-agreements"),
    feature("Message review", "Make every follow-up worth opening.", "Review the proposed message, customer preferences and consent before sending. The owner’s approval rules remain part of the workflow.", "Check recipient and context|Review the draft|Respect consent and approvals", "reminders-win-backs"),
    feature("Return requests", "Give customers an easy way back.", "Connect a reminder to a new service request. The relationship continues with the history your team already has.", "Request the next service|Keep customer history|Prepare the visit", "online-booking")
  ],
  "reporting-job-sources": [
    feature("Recorded attribution", "Keep track of where the work starts.", "Carry the recorded source from the inquiry into the connected job. Missing source data stays explicit rather than being guessed.", "Record inquiry sources|Keep linked records together|See attribution gaps", "reporting-job-sources"),
    feature("The service journey", "Follow the inquiry beyond the first click.", "Review linked requests, estimates and jobs to understand how the work moved through the business.", "See linked estimates|Follow approved work|Review completed jobs", "jobs-work-orders"),
    feature("Owner visibility", "Make decisions from the record.", "Bring available outcomes into the owner’s review. Use the evidence behind an opportunity instead of treating an unexplained score as a decision.", "Review available outcomes|Inspect source context|Choose the next action", "ai-revenue-intelligence")
  ],
  "customers-properties-assets": [
    feature("Customer context", "Know who you are working for.", "Keep contact details and the service relationship in one customer record. Give the team a useful starting point for the next conversation.", "Review contact details|Keep customer history|Connect the next request", "customers-properties-assets"),
    feature("Property and equipment", "Know the place before the visit.", "Bring site and equipment details into the work. Keep the information the technician needs alongside the job being planned.", "Review property notes|Keep equipment context|Prepare the technician", "technician-app"),
    feature("Service history", "Pick up where the last visit ended.", "Connect previous work orders and supporting notes to the relationship. New work starts with what the team already knows.", "Review previous jobs|Keep photos and notes|Carry context into estimates", "jobs-work-orders")
  ],
  "onboarding-data-import": [
    feature("Your existing records", "Bring a useful starting point.", "Prepare supported business exports for onboarding. Keep your existing customer and service context at the center of the move.", "Review supported source files|Identify the records to bring|Confirm scope during onboarding", "onboarding-data-import"),
    feature("Review before import", "See what comes across before confirming.", "Review mapping and validation results before completing the import. Unsupported or missing data should be visible, not quietly guessed.", "Check field mappings|Review validation findings|Confirm the import", "onboarding-data-import", 1),
    feature("Ready for the next job", "Put the imported context to work.", "Bring supported customer, property and related records into the team’s starting point. Preserve the relationships that make the data useful.", "Keep customer context|Review related properties|Prepare the first workflow", "customers-properties-assets")
  ],
  "ai-revenue-intelligence": [
    feature("Business opportunities", "See where a next action may help.", "Surface opportunities from the available records, such as an open estimate. Start with something the owner can inspect, not a promise of revenue.", "Review open opportunities|See the underlying record|Keep evidence visible", "ai-revenue-intelligence"),
    feature("The proposal", "Understand the move before making it.", "Review the context and proposed response together. Recommendations do not override permissions, consent or financial controls.", "Review the proposed action|Keep owner approval|Hold or adjust the next step", "inquiry-response-follow-up"),
    feature("The outcome", "Keep learning from what happened.", "Follow recorded activity and linked outcomes. Give the next decision a better starting point without inventing missing attribution.", "Review recorded actions|Follow linked outcomes|Keep attribution gaps explicit", "reporting-job-sources")
  ]
};

export const TRADE_HEADINGS: Record<string, readonly [string, string, string]> = {
  hvac: ["Plan the repair around the equipment.", "Keep busy service days under control.", "Turn a repair into the next maintenance visit."],
  plumbing: ["Get the details before the truck rolls.", "Keep urgent calls and planned work together.", "Leave a service record worth coming back to."],
  electrical: ["Build a clear scope before the work begins.", "Put the right details in the field.", "Keep the property’s service history connected."],
  "appliance-repair": ["Start with the model, not another phone call.", "Keep diagnosis and the repair visit connected.", "Make the next service call easier."],
  "garage-doors": ["Know the door before the visit.", "Keep the repair and crew on the same page.", "Be ready when that customer calls again."],
  locksmith: ["Capture the service and appointment details.", "Keep the visit scope clear.", "Leave a connected record of the work."],
  cleaning: ["Quote the rooms and tasks, not a guess.", "Give the crew a clear cleaning checklist.", "Make the next clean a natural next step."],
  "pest-control": ["Start with the property and reported issue.", "Keep every service visit documented.", "Keep the return conversation in view."],
  chimney: ["Bring the assessment into the estimate.", "Keep the chimney visit and photos together.", "Keep the history ready for next season."],
  "pressure-washing": ["Build the scope from the actual surfaces.", "Give the crew the full property context.", "Let the finished work tell the story."],
  "tree-care": ["Turn the site assessment into a clear plan.", "Keep the crew working from one scope.", "Keep a useful history of the property."],
  alarm: ["Bring equipment details into the visit.", "Keep the service team and office connected.", "Have the service history ready next time."],
  "air-duct": ["Start with the property and access details.", "Keep the agreed service scope in the field.", "Make future service easier to plan."],
  "carpet-cleaning": ["Quote the rooms and flooring clearly.", "Give the crew the details behind the job.", "Turn good work into a return booking."]
};
