import type { IndustrySlug } from "./industry-registry";

export type IndustryJourney = {
  focus: string;
  value: string;
  benefits: readonly [string, string, string];
  discover: { title: string; body: string; action: string };
  deliver: { title: string; body: string; scope: string };
  retain: { title: string; body: string; nextVisit: string };
  ownerOutcome: string;
  tools: readonly [{ slug: string; value: string }, { slug: string; value: string }];
};

/** Marketing examples, not new mission options or promises of automatic execution. */
export const INDUSTRY_JOURNEYS: Record<IndustrySlug, IndustryJourney> = {
  hvac: {
    focus: "heating and cooling service visits",
    value: "Turn a goal for more HVAC bookings into local demand, approved repairs and ongoing maintenance. Operating Missions and five connected products keep the whole customer journey in view.",
    benefits: ["Find the next service call", "Turn requests into paid work", "Build maintenance relationships"],
    discover: { title: "A fuller schedule starts before the phone rings.", body: "Growth connects your heating and cooling services to local discovery and a clear service request. Equipment details and the customer's concern travel with the inquiry, giving Revenue a useful starting point.", action: "Bring local heating and cooling inquiries into one request." },
    deliver: { title: "From no heat to a completed, paid visit.", body: "Revenue helps prepare an email or onsite estimate. Once the scope is confirmed and approved, Operations carries it into the work order, technician visit and mobile payment. The office is not rebuilding the story at every step.", scope: "Heating or cooling repair · Approved scope" },
    retain: { title: "Make today's repair the start of ongoing care.", body: "Retention uses the completed service record to prepare a review invitation and the next maintenance or membership conversation. Command Center keeps those proposed actions and the original booking goal visible to the owner.", nextVisit: "Prepare the next appropriate maintenance conversation." },
    ownerOutcome: "Review service bookings, paid work and maintenance opportunities together.",
    tools: [{ slug: "scheduling-dispatch", value: "Place approved HVAC work into the technician's day with equipment and visit context attached." }, { slug: "service-agreements", value: "Connect maintenance terms and covered visits to the relationship after the repair." }]
  },
  plumbing: {
    focus: "local plumbing repair requests",
    value: "Connect the goal of more plumbing bookings to the first leak inquiry, approved repair, payment and next call. Five flagship products keep the opportunity moving beyond the inbox.",
    benefits: ["Attract local repair requests", "Move from scope to payment", "Become the next call"],
    discover: { title: "Give the next plumbing customer a clear way in.", body: "Growth puts your repair services and service area in front of the customer journey. A leaking-fixture request arrives with property details and photos, so Revenue can respond to the actual problem rather than restart the conversation.", action: "Connect local discovery to a plumbing repair request." },
    deliver: { title: "Keep the repair moving, not the paperwork.", body: "Revenue helps clarify the repair and present an email or onsite estimate. Operations takes the approved scope into the work order, assigned visit, job documentation and payment, keeping the office and plumber on the same record.", scope: "Leaking fixture repair · Scope confirmed" },
    retain: { title: "Finish one repair. Earn the next conversation.", body: "Retention prepares a relevant review request or future service reminder from what was actually done. Command Center lets the owner review the follow-up and see whether the booking mission is producing completed plumbing work.", nextVisit: "Use the repair history for a relevant return-service invitation." },
    ownerOutcome: "Follow plumbing inquiries through accepted repairs, payment and return opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Make the repair scope and customer decision clear before the plumber starts work." }, { slug: "scheduling-dispatch", value: "Keep approved plumbing visits and assignment changes visible to the office and field." }]
  },
  electrical: {
    focus: "electrical assessment and repair bookings",
    value: "Bring the right electrical requests into the business, turn them into approved work and keep the customer relationship after payment. Operating Missions gives all five products a shared goal.",
    benefits: ["Find the right electrical work", "Keep scope and field work aligned", "Build on every property visit"],
    discover: { title: "Start with the electrical work you want more of.", body: "Growth connects your electrical services and service area to a clear assessment request. Property notes and customer photos give Revenue context for the next conversation, rather than leaving a promising inquiry scattered across messages.", action: "Bring property and requested electrical work into the inquiry." },
    deliver: { title: "Turn an assessment into a clear, paid job.", body: "Revenue supports an email estimate or onsite assessment before scope approval. Operations carries the confirmed estimate into the work order, technician tasks, photos and mobile payment, so the work performed stays tied to what the customer accepted.", scope: "Electrical service assessment · Agreed work" },
    retain: { title: "Let a well-documented visit support the next one.", body: "Retention uses the completed record for a review invitation or a relevant future service conversation. Command Center keeps the owner involved in approvals and shows the path from the electrical inquiry to the completed job.", nextVisit: "Prepare a relevant follow-up from the property's service record." },
    ownerOutcome: "Review electrical requests, approved jobs and follow-up opportunities in context.",
    tools: [{ slug: "estimates-approvals", value: "Keep the electrical scope and customer approval clear before work proceeds." }, { slug: "time-tracking-job-photos", value: "Keep visit time and job photos with the work for a clearer completion record." }]
  },
  "appliance-repair": {
    focus: "appliance diagnosis and repair visits",
    value: "Connect appliance repair demand to an informed estimate, a prepared technician and a customer who knows whom to call again. Five products work toward the owner's booking goal.",
    benefits: ["Capture better repair inquiries", "Prepare the technician", "Keep the next repair connected"],
    discover: { title: "Turn appliance trouble into a useful request.", body: "Growth connects local appliance-service discovery to a request with model details, symptoms and photos. Revenue starts with the customer's actual issue, helping the business move from a general inquiry to a diagnosis or repair conversation.", action: "Carry the appliance, model and reported issue into the inquiry." },
    deliver: { title: "Send the technician the story, not just the address.", body: "Revenue helps prepare an email or onsite estimate and capture approval. Operations brings the appliance details and agreed work into the work order, field notes, repair photos and mobile payment so the visit can finish with a clear record.", scope: "Appliance diagnosis or repair · Confirmed scope" },
    retain: { title: "Make the next appliance call easier to handle.", body: "Retention prepares a review invitation or appropriate follow-up from the completed repair. Command Center gives the owner the context to review the next move and understand which appliance inquiries became paid work.", nextVisit: "Use the appliance history when a customer needs service again." },
    ownerOutcome: "Review appliance inquiries, completed repairs and customer follow-up together.",
    tools: [{ slug: "customers-properties-assets", value: "Keep appliance and property details available when preparing the estimate and visit." }, { slug: "technician-app", value: "Put the repair context, job notes and completion steps in the technician's hands." }]
  },
  "garage-doors": {
    focus: "garage door repair and opener service bookings",
    value: "Turn a goal for more garage door bookings into qualified requests, approved repairs and paid visits. Keep the door and opener history ready for the next service opportunity.",
    benefits: ["Bring in door-service demand", "Turn estimates into paid visits", "Keep the customer after the repair"],
    discover: { title: "Make the next stuck door your next opportunity.", body: "Growth connects your garage door and opener services to local discovery and a service request. Door details, photos and the customer's problem travel into Revenue, so the business can respond with context instead of chasing missing information.", action: "Connect local door-service interest to a qualified request." },
    deliver: { title: "From door assessment to approved, completed work.", body: "Revenue helps turn the request into an email or onsite estimate. After the scope is confirmed and approved, Operations carries it into the work order, technician visit, job photos and mobile payment. The customer decision stays with the repair.", scope: "Garage door or opener repair · Customer-approved work" },
    retain: { title: "Keep the relationship after the door works again.", body: "Retention prepares a review invitation and an appropriate future service conversation from the completed repair. Command Center lets the owner review the next action and follow the original booking goal through to paid garage door work.", nextVisit: "Prepare a future door-service reminder when appropriate." },
    ownerOutcome: "See which door inquiries became approved repairs, paid visits and return opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Make the garage door repair scope and customer acceptance clear before the visit proceeds." }, { slug: "technician-app", value: "Carry door details, approved work and repair photos through the field visit and closeout." }]
  },
  locksmith: {
    focus: "lock repair and planned service appointments",
    value: "Connect local lock-service demand to an agreed visit, completed work and payment. The five flagship products keep the customer journey connected without losing owner oversight.",
    benefits: ["Bring in relevant service requests", "Keep appointments on track", "Be easier to call again"],
    discover: { title: "Give the next lock-service customer a clear next step.", body: "Growth connects your listed services and service area to a request with the needed appointment details. Revenue can respond to the requested lock service and prepare the visit conversation rather than leaving the inquiry in an inbox.", action: "Connect local discovery to a lock-service appointment request." },
    deliver: { title: "Keep the agreed service with the visit.", body: "Revenue helps clarify the proposed work through an email or onsite estimate. After confirmation and approval, Operations carries the scope into the assigned job, service notes and payment. Your verification and service policies still govern the visit.", scope: "Lock repair appointment · Agreed service scope" },
    retain: { title: "Leave a service record worth coming back to.", body: "Retention prepares a review invitation or relevant future service follow-up from the completed appointment. Command Center keeps the owner in control of that outreach and connects the booking goal to the work actually completed.", nextVisit: "Keep the prior service context ready for the customer's next appointment." },
    ownerOutcome: "Review lock-service requests, completed appointments and payment status together.",
    tools: [{ slug: "scheduling-dispatch", value: "Keep the agreed appointment and technician assignment visible as the day changes." }, { slug: "invoices-payments", value: "Carry completed service into a clear invoice and connected payment record." }]
  },
  cleaning: {
    focus: "home cleaning bookings that can become repeat visits",
    value: "Connect new cleaning demand to a clear scope, a completed clean and the next booking. Operating Missions gives the five flagship products a goal beyond filling one appointment.",
    benefits: ["Attract the next cleaning client", "Deliver the agreed clean", "Make rebooking easier"],
    discover: { title: "Find customers you can keep serving.", body: "Growth connects your cleaning services to local discovery and an inquiry with rooms, tasks and preferred timing. Revenue receives enough context to discuss the clean, rather than making the customer explain the request all over again.", action: "Capture room and cleaning needs with the new inquiry." },
    deliver: { title: "Turn a cleaning quote into a clear crew visit.", body: "Revenue helps prepare the email or onsite estimate and confirm the customer's approval. Operations carries the agreed tasks into the work order, crew visit, completion notes and payment so the team knows what a finished clean should include.", scope: "Home cleaning visit · Approved rooms and tasks" },
    retain: { title: "Make a good first clean the start of a routine.", body: "Retention prepares a review invitation and a next-clean reminder suited to the customer. Command Center helps the owner review the message and see how the booking mission is building repeat relationships, not just one-time visits.", nextVisit: "Invite the customer to arrange their next clean with consent." },
    ownerOutcome: "Review first bookings, completed cleans and rebooking opportunities together.",
    tools: [{ slug: "jobs-work-orders", value: "Keep agreed rooms, tasks and crew notes together for a consistent cleaning visit." }, { slug: "reminders-win-backs", value: "Prepare relevant, consented invitations for the next clean instead of starting acquisition again." }]
  },
  "pest-control": {
    focus: "pest-service assessments and ongoing customer care",
    value: "Connect the first pest-service inquiry to an approved visit, payment and an appropriate return conversation. Five products keep the business goal and property history connected.",
    benefits: ["Bring in assessment requests", "Keep the visit scope clear", "Support ongoing service"],
    discover: { title: "Turn a reported problem into the right conversation.", body: "Growth connects local pest-service discovery to a request with property details, the reported issue and customer photos. Revenue can prepare an assessment or service conversation around the actual need rather than treating every lead the same.", action: "Carry the property and reported pest issue into the inquiry." },
    deliver: { title: "Move from assessment to an accountable visit.", body: "Revenue helps prepare an email or onsite estimate and confirm the agreed scope. Operations carries the approved work into scheduling, the field record and payment. Required trade procedures remain part of your team's responsibilities.", scope: "Pest-service visit · Confirmed assessment and scope" },
    retain: { title: "Keep the next service conversation in view.", body: "Retention uses the completed visit and agreement context to prepare an appropriate reminder or renewal conversation. Command Center keeps owner review attached, connecting the original booking mission to ongoing service opportunities.", nextVisit: "Prepare the next visit or agreement conversation when appropriate." },
    ownerOutcome: "Review assessment requests, completed service and ongoing-care opportunities.",
    tools: [{ slug: "scheduling-dispatch", value: "Keep approved pest-service visits and technician assignments aligned with the day's capacity." }, { slug: "service-agreements", value: "Keep agreed service terms and future visits connected to the customer relationship." }]
  },
  chimney: {
    focus: "chimney service and seasonal assessment appointments",
    value: "Connect seasonal chimney demand to a clear assessment, approved service, payment and a future reminder. Operating Missions keeps the five products working toward the same business goal.",
    benefits: ["Capture seasonal demand", "Document approved service", "Stay ready for next season"],
    discover: { title: "Give seasonal interest a place to become a booking.", body: "Growth connects your chimney services and service area to an appointment request. Property details and the customer's reason for calling travel into Revenue, creating a clearer starting point for the assessment and estimate.", action: "Connect chimney-service discovery to an assessment request." },
    deliver: { title: "Keep the assessment, agreement and visit together.", body: "Revenue supports an email or onsite estimate after the relevant assessment. Operations carries approved work into the work order, visit notes, job photos and payment, giving the office a clearer account of what was agreed and completed.", scope: "Chimney assessment and service · Approved work" },
    retain: { title: "Keep this season's customer in next season's picture.", body: "Retention prepares a review invitation and an appropriate seasonal follow-up from the service history. Command Center lets the owner review the outreach and see whether seasonal inquiries are becoming completed visits and return opportunities.", nextVisit: "Prepare an appropriate next-season service reminder." },
    ownerOutcome: "Connect seasonal inquiries to approved work, paid visits and future service.",
    tools: [{ slug: "estimates-approvals", value: "Present the assessed chimney-service scope clearly and retain the customer's decision." }, { slug: "time-tracking-job-photos", value: "Keep visit time and relevant chimney-service photos with the completed job." }]
  },
  "pressure-washing": {
    focus: "driveway and exterior cleaning bookings",
    value: "Turn local property-cleaning interest into an agreed quote, documented work and payment. Keep the next cleaning opportunity connected through Operating Missions and all five products.",
    benefits: ["Attract property-cleaning requests", "Make the quoted scope clear", "Create a reason to rebook"],
    discover: { title: "Turn a property's first impression into your next job.", body: "Growth connects your exterior-cleaning services to local discovery and a request with surfaces and site photos. Revenue receives the context needed for an estimate conversation, instead of chasing the details across several messages.", action: "Capture the surfaces, property photos and cleaning request together." },
    deliver: { title: "Keep the quoted surfaces with the work.", body: "Revenue helps prepare an email or onsite estimate with a clear cleaning scope. Operations carries the approved work into the visit, before-and-after documentation and payment so the customer and crew share the same understanding.", scope: "Driveway or exterior clean · Approved surfaces" },
    retain: { title: "Let a finished property lead to the next conversation.", body: "Retention prepares a review invitation and a relevant future cleaning reminder from the completed record. Command Center keeps owner approval and mission progress visible, rather than treating a paid job as the end of the relationship.", nextVisit: "Prepare a relevant future property-cleaning invitation." },
    ownerOutcome: "Review property inquiries, accepted cleaning work and repeat-service opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Tie the selected surfaces and agreed cleaning scope to the customer's approval." }, { slug: "time-tracking-job-photos", value: "Keep before-and-after photos and visit time with the job the customer approved." }]
  },
  "tree-care": {
    focus: "tree-care site assessments and crew bookings",
    value: "Connect local tree-care demand to site assessment, approved scope, crew work and payment. Use the completed property record to support the next opportunity, not another disconnected lead.",
    benefits: ["Bring in assessment requests", "Align the scope and crew", "Build the property relationship"],
    discover: { title: "Start the next crew job with a useful assessment request.", body: "Growth connects your tree-care services to local discovery and a request with site details and photos. Revenue can prepare the assessment conversation around the property and requested work before proposing the scope.", action: "Carry tree and site details from discovery into the request." },
    deliver: { title: "Turn the assessed scope into a coordinated visit.", body: "Revenue supports an estimate after the site assessment and captures the customer's approval. Operations carries the confirmed scope into the work order, crew assignment, job documentation and payment, while field judgments stay with qualified staff.", scope: "Tree-care crew visit · Site-assessed scope" },
    retain: { title: "Keep the property relationship after the crew leaves.", body: "Retention prepares a review invitation or appropriate future tree-care conversation from the completed visit. Command Center lets the owner review next actions and connect the booking mission to approved work and ongoing property relationships.", nextVisit: "Use site history for a relevant future care conversation." },
    ownerOutcome: "Review site assessments, approved crew jobs and future property opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Keep the site-assessed scope and customer decision together before assigning the work." }, { slug: "scheduling-dispatch", value: "Bring the approved crew visit and assignment context into the day's schedule." }]
  },
  alarm: {
    focus: "alarm-equipment service appointments",
    value: "Connect alarm-service demand to a prepared technician, completed work and the next service conversation. Five flagship products support the business journey, not a monitoring or emergency-response promise.",
    benefits: ["Capture service demand", "Carry equipment context", "Build ongoing service relationships"],
    discover: { title: "Bring the right equipment-service request into view.", body: "Growth connects your alarm-service offering and service area to a request with equipment and model details. Revenue receives the customer's requested service in context so the office can prepare the estimate or assessment conversation.", action: "Connect local discovery to an alarm-equipment service request." },
    deliver: { title: "Keep the agreed work with the technician.", body: "Revenue helps prepare an email or onsite estimate and confirm the approved scope. Operations carries the equipment context into the work order, technician notes, completed visit and payment without turning service software into a monitoring system.", scope: "Alarm-equipment service · Approved visit scope" },
    retain: { title: "Make the next service appointment easier to plan.", body: "Retention uses equipment and agreement history to prepare an appropriate service or renewal conversation. Command Center keeps the owner involved in review and connects new booking activity to completed work and ongoing relationships.", nextVisit: "Prepare an appropriate equipment-service or agreement follow-up." },
    ownerOutcome: "Review equipment-service requests, paid visits and future service obligations.",
    tools: [{ slug: "customers-properties-assets", value: "Keep alarm equipment and property context ready for the estimate and technician." }, { slug: "service-agreements", value: "Connect agreed service terms and future appointments to the customer record." }]
  },
  "air-duct": {
    focus: "air duct cleaning assessments and service visits",
    value: "Connect local air duct service demand to a clear scope, a documented visit and payment. Keep future service conversations tied to the property through the five flagship products.",
    benefits: ["Bring in property-service requests", "Keep scope and access clear", "Build on the completed visit"],
    discover: { title: "Turn local interest into an informed service request.", body: "Growth connects your air duct services to discovery and a request with property details, access notes and customer photos. Revenue starts with the information needed for an assessment or estimate conversation, rather than another incomplete lead.", action: "Bring property and access details into the air duct inquiry." },
    deliver: { title: "Carry the agreed service through to payment.", body: "Revenue helps prepare an email or onsite estimate and confirm the scope. Operations carries approved work into the work order, technician visit, notes, relevant photos and payment so the office can follow what was actually completed.", scope: "Air duct service visit · Agreed scope and access" },
    retain: { title: "Keep a useful property history for the next call.", body: "Retention prepares a review invitation and an appropriate follow-up using the completed visit. Command Center keeps the owner in control of outreach and makes the path from booking goal to paid property service easier to review.", nextVisit: "Use the visit history for an appropriate future service conversation." },
    ownerOutcome: "Review air duct inquiries, approved visits and future property-service opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Keep the proposed duct-cleaning scope and customer approval together." }, { slug: "time-tracking-job-photos", value: "Connect recorded visit time and relevant service photos to the completed work." }]
  },
  "carpet-cleaning": {
    focus: "carpet cleaning appointments and repeat customers",
    value: "Connect room-by-room cleaning demand to a clear quote, completed job and next booking. Operating Missions gives all five products a shared goal for the customer relationship.",
    benefits: ["Attract the next cleaning request", "Deliver the agreed rooms", "Make the next clean easier"],
    discover: { title: "Turn a room-refresh idea into your next booking.", body: "Growth connects local carpet-cleaning discovery to a request with rooms, flooring details and photos. Revenue gets a useful starting point for the estimate conversation instead of asking the customer to repeat the request.", action: "Carry rooms and requested carpet-cleaning work into the inquiry." },
    deliver: { title: "Keep the quote and the completed clean aligned.", body: "Revenue supports an email or onsite estimate and captures approval for the rooms and scope. Operations carries that work into the visit, completion notes, photos and payment, keeping the customer decision attached to the job.", scope: "Carpet-cleaning appointment · Approved rooms" },
    retain: { title: "Give a happy customer a clear way to book again.", body: "Retention prepares a review invitation and a relevant next-clean reminder based on the completed job and customer preferences. Command Center lets the owner review the outreach and follow the booking mission into repeat-service opportunities.", nextVisit: "Prepare a consented invitation for the next appropriate clean." },
    ownerOutcome: "Review new cleaning inquiries, paid appointments and repeat-customer opportunities.",
    tools: [{ slug: "estimates-approvals", value: "Keep the agreed rooms and carpet-cleaning scope clear before the visit." }, { slug: "reminders-win-backs", value: "Prepare a relevant, consented return invitation using the customer's cleaning history." }]
  }
};
