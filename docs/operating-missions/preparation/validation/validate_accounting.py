#!/usr/bin/env python3
"""Check the arithmetic of the adjacent synthetic preparation fixtures only.

This is not application code, a database projector, a production event contract,
or evidence that any OM acceptance case passes in Renvani. It reads one local JSON
file and uses only Python's standard library. All policy values are fixture-only.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo


class FixtureError(ValueError):
    """Malformed or inconsistent synthetic evidence."""


CENT = Decimal("0.01")
ZERO = Decimal("0.00")
MONEY = re.compile(r"^(0|[1-9][0-9]*)\.[0-9]{2}$")


def money(value):
    if not isinstance(value, str) or not MONEY.fullmatch(value):
        raise FixtureError(f"Expected unsigned scale-2 decimal string, got {value!r}")
    return Decimal(value)


def rendered(value):
    return format(value.quantize(CENT, rounding=ROUND_HALF_UP), ".2f")


def instant(value):
    if not isinstance(value, str) or not value.endswith("Z"):
        raise FixtureError(f"Expected explicit UTC instant, got {value!r}")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FixtureError(f"Invalid instant {value!r}") from exc


def month(value, zone):
    return instant(value).astimezone(ZoneInfo(zone)).strftime("%Y-%m")


def seconds(start, end):
    duration = instant(end) - instant(start)
    if duration.total_seconds() < 0:
        raise FixtureError("A measured stage cannot end before it starts")
    return duration.days * 86400 + duration.seconds


def current_facts(scenario, events):
    """Select fixture source revisions; this deliberately has no persistence."""
    by_event, by_revision, latest = {}, {}, {}
    for event in events:
        required = {
            "eventId", "canonicalFactId", "companyId", "sourceEntity",
            "sourceVersion", "occurredAt", "receivedAt", "kind", "data",
        }
        if set(event) != required:
            raise FixtureError("Fixture event envelope differs from the declared local shape")
        if event["companyId"] != scenario["companyId"]:
            raise FixtureError("Cross-tenant fact in a single-tenant fixture")
        if type(event["sourceVersion"]) is not int or event["sourceVersion"] < 1:
            raise FixtureError("sourceVersion must be a positive fixture revision")
        if set(event["sourceEntity"]) != {"type", "id"}:
            raise FixtureError("Source entity needs type and ID")
        occurred, received = instant(event["occurredAt"]), instant(event["receivedAt"])
        if received < occurred:
            raise FixtureError("This fixture disallows receipt before occurrence")
        event_key = event["eventId"]
        if event_key in by_event and by_event[event_key] != event:
            raise FixtureError("Same event ID has conflicting contents")
        by_event[event_key] = event
        key = event["canonicalFactId"]
        revision_key = (key, event["sourceVersion"])
        # Transport IDs/receipt times may differ on replay; source content may not.
        source_content = {k: v for k, v in event.items() if k not in {"eventId", "receivedAt"}}
        if revision_key in by_revision and by_revision[revision_key] != source_content:
            raise FixtureError("Same canonical fact/version has conflicting source content")
        by_revision[revision_key] = source_content
        if key in latest:
            prior = latest[key]
            if prior["kind"] != event["kind"] or prior["sourceEntity"] != event["sourceEntity"]:
                raise FixtureError("A canonical fact cannot silently change source or kind")
        if key not in latest or event["sourceVersion"] > latest[key]["sourceVersion"]:
            latest[key] = event
    return latest


def financial(scenario, facts):
    """Finite, explicitly closed synthetic arithmetic; no source-system inference."""
    zone = scenario["policyInputs"]["timeZone"]
    policy = scenario["policyInputs"]
    service_month, cash_month = policy.get("serviceMonth"), policy.get("cashMonth")
    selected = lambda at, period: period is None or month(at, zone) == period
    by_kind = lambda kind: [e for e in facts.values() if e["kind"] == kind]
    completions = {e["data"]["jobId"]: e for e in by_kind("service_completion")}
    allocations = {e["canonicalFactId"]: e for e in by_kind("service_allocation")}
    credits = {e["canonicalFactId"]: e for e in by_kind("revenue_credit")}
    payments = {e["canonicalFactId"]: e for e in by_kind("settled_payment")}
    refunds = by_kind("cash_refund")
    earned = ZERO
    finalized_jobs = set()
    for key, event in allocations.items():
        data = event["data"]
        if data["jobId"] not in completions:
            raise FixtureError("Service allocation needs verified completion in this fixture")
        if data["basis"] not in {"gross", "already_net"}:
            raise FixtureError("Unknown allocation basis")
        amount = money(data["amount"])
        embedded = set(data["includedAdjustmentIds"])
        if len(embedded) != len(data["includedAdjustmentIds"]):
            raise FixtureError("Embedded adjustment IDs must be unique")
        if data["basis"] == "gross" and embedded:
            raise FixtureError("Gross allocation cannot embed adjustments")
        for adjustment_id in embedded:
            if adjustment_id not in credits or credits[adjustment_id]["data"]["allocationId"] != key:
                raise FixtureError("Embedded adjustment needs its linked source credit")
        for adjustment_id, credit in credits.items():
            if credit["data"]["allocationId"] == key and adjustment_id not in embedded:
                amount -= money(credit["data"]["amount"])
        if amount < ZERO:
            raise FixtureError("These fixtures do not model credits exceeding their allocation")
        finalized_jobs.add(data["jobId"])
        performed_at = completions[data["jobId"]]["data"]["performedAt"]
        instant(data["finalizedAt"])
        if selected(performed_at, service_month):
            earned += amount
    for credit in credits.values():
        if credit["data"]["allocationId"] not in allocations:
            raise FixtureError("Credit has no service allocation in this closed fixture")
        money(credit["data"]["amount"])

    cash_gross = sum((money(e["data"]["amount"]) for e in payments.values()
                      if selected(e["data"]["settledAt"], cash_month)), ZERO)
    cash_refunds = ZERO
    refund_by_payment = {}
    for event in refunds:
        data = event["data"]
        payment_id = data["paymentId"]
        if payment_id not in payments:
            raise FixtureError("Refund requires its original settled allocation")
        amount = money(data["amount"])
        refund_by_payment[payment_id] = refund_by_payment.get(payment_id, ZERO) + amount
        if refund_by_payment[payment_id] > money(payments[payment_id]["data"]["amount"]):
            raise FixtureError("Refunds exceed original settled allocation")
        credit_id = data.get("linkedCreditId")
        if credit_id is not None and credit_id not in credits:
            raise FixtureError("Linked refund is missing its revenue credit")
        if selected(data["refundedAt"], cash_month):
            cash_refunds += amount

    agreement_revenue = ZERO
    agreement_unknown = []
    contracts = ZERO
    agreements = {e["canonicalFactId"]: e for e in by_kind("agreement_terms")}
    recognitions = by_kind("agreement_recognition")
    for key, event in agreements.items():
        data = event["data"]
        contract = money(data["contractValue"])
        contracts += contract
        if data["recognitionPolicyId"] is None:
            agreement_unknown.append(key)
            continue
        declared = policy.get("agreementRecognition", {})
        if data["recognitionPolicyId"] != declared.get("id"):
            raise FixtureError("Recognition requires the scenario's explicit fixture policy")
        recognized_total = ZERO
        seen_obligations = set()
        for recognition in recognitions:
            recognized = recognition["data"]
            if recognized["agreementId"] != key:
                continue
            obligation = recognized["obligationId"]
            schedule = declared["obligationAmounts"]
            if obligation not in schedule or obligation in seen_obligations:
                raise FixtureError("Unknown or duplicated agreement obligation")
            seen_obligations.add(obligation)
            amount = money(recognized["amount"])
            if amount != money(schedule[obligation]) or recognized["fulfillmentVerified"] is not True:
                raise FixtureError("Recognition differs from fixture obligation policy/evidence")
            fulfillment = facts.get(recognized["fulfillmentFactId"])
            if (fulfillment is None or fulfillment["kind"] != "agreement_benefit_fulfilled"
                    or fulfillment["data"]["agreementId"] != key
                    or fulfillment["data"]["obligationId"] != obligation):
                raise FixtureError("Recognition requires its matching fulfilled-obligation fixture fact")
            recognized_total += amount
            if selected(recognized["earnedAt"], service_month):
                agreement_revenue += amount
        if recognized_total > contract:
            raise FixtureError("Fixture agreement recognized above contract value")
    if any(e["data"]["agreementId"] not in agreements for e in recognitions):
        raise FixtureError("Recognition has no agreement")
    # If an included agreement lacks policy, do not represent its unknown value as zero.
    earned_total = None if agreement_unknown else earned + agreement_revenue
    known_earned = earned + agreement_revenue

    cost_components = {}
    for event in by_kind("variable_cost"):
        data = event["data"]
        if not data["historicalSourceRef"]:
            raise FixtureError("Known variable cost needs a historical source reference")
        component = data["component"]
        cost_components[component] = cost_components.get(component, ZERO) + money(data["amount"])
    required_costs = policy.get("requiredCostComponents")
    missing_costs = [] if required_costs is None else sorted(set(required_costs) - set(cost_components))
    cost_total = sum(cost_components.values(), ZERO)
    full_contribution = None
    if required_costs is not None and not missing_costs and earned_total is not None:
        full_contribution = rendered(earned_total - cost_total)

    invoices = {e["canonicalFactId"]: e for e in by_kind("invoice_finalized")}
    balances = {}
    for key, event in invoices.items():
        amount = money(event["data"]["totalDue"])
        amount -= sum((money(e["data"]["amount"]) for e in credits.values()
                       if e["data"]["invoiceId"] == key), ZERO)
        for payment_id, payment in payments.items():
            if payment["data"].get("invoiceId") == key:
                amount -= money(payment["data"]["amount"])
                amount += refund_by_payment.get(payment_id, ZERO)
        if amount < ZERO:
            raise FixtureError("Fixture invoice balance is negative")
        balances[key] = rendered(amount)

    bookings = by_kind("booking_state")
    confirmed = [e for e in bookings if e["data"]["status"] == "confirmed"]
    booking_types = sorted({e["data"]["bookingType"] for e in bookings})
    contributors = by_kind("outcome_contributor")
    for event in contributors:
        if event["data"]["outcomeFactId"] not in allocations:
            raise FixtureError("Contributor must refer to a canonical service outcome")
    receipts = by_kind("message_receipt")
    result = {
        "performed_service_revenue": rendered(earned),
        "earned_agreement_revenue": None if agreement_unknown else rendered(agreement_revenue),
        "net_earned_service_revenue": None if earned_total is None else rendered(earned_total),
        "known_earned_subtotal": rendered(known_earned),
        "agreement_revenue_unavailable_ids": sorted(agreement_unknown),
        "net_collected_cash": rendered(cash_gross - cash_refunds),
        "settled_cash_before_refunds": rendered(cash_gross),
        "cash_refunds": rendered(cash_refunds),
        "agreement_contract_value": rendered(contracts),
        "accepted_work_value": rendered(sum((money(e["data"]["amount"])
                                             for e in by_kind("estimate_accepted")), ZERO)),
        "pending_unbilled_completed_work_count": sum(
            1 for job_id, e in completions.items()
            if e["data"]["billable"] is True and job_id not in finalized_jobs
            and selected(e["data"]["performedAt"], service_month)
        ),
        "completed_job_count": len(completions),
        "known_variable_cost_total": rendered(cost_total),
        "known_cost_remainder": None if earned_total is None else rendered(earned_total - cost_total),
        "missing_cost_components": missing_costs,
        "contribution_before_fixed_overhead": full_contribution,
        "contribution_status": "not_requested" if required_costs is None else
            ("incomplete" if full_contribution is None else "complete_for_fixture_scope"),
        "invoice_balances": balances,
        "open_invoice_balance": rendered(sum((Decimal(v) for v in balances.values()), ZERO)),
        "net_confirmed_bookings": len(confirmed),
        "confirmed_bookings_by_type": {
            kind: sum(e["data"]["bookingType"] == kind for e in confirmed) for kind in booking_types
        },
        "outcome_contributor_count": len(contributors),
        "delivered_message_count": sum(e["data"]["stage"] == "delivered" for e in receipts),
        "queued_message_count": sum(e["data"]["stage"] == "queued" for e in receipts),
        "provider_accepted_message_count": sum(e["data"]["stage"] == "provider_accepted" for e in receipts),
    }
    return result


def frozen_cohorts(facts):
    cohorts = {}
    for event in facts.values():
        if event["kind"] != "cohort_frozen":
            continue
        data = event["data"]
        members = data["memberIds"]
        if not members or len(members) != len(set(members)) or len(members) != data["declaredSize"]:
            raise FixtureError("Frozen cohort needs nonempty unique members and its declared denominator")
        cohorts[event["canonicalFactId"]] = data
    return cohorts


def job_value(scenario, facts):
    cohorts = frozen_cohorts(facts)
    output = {}
    for key, cohort in cohorts.items():
        rows = [e["data"] for e in facts.values()
                if e["kind"] == "cohort_completed_job" and e["data"]["cohortId"] == key]
        seen_jobs = set()
        revenue, mix = ZERO, {}
        for row in rows:
            if row["opportunityId"] not in cohort["memberIds"] or row["jobId"] in seen_jobs:
                raise FixtureError("Completed result is outside cohort or duplicates a canonical job")
            seen_jobs.add(row["jobId"])
            amount = money(row["netEarnedAmount"])
            revenue += amount
            group = mix.setdefault(row["serviceSituation"], {"count": 0, "revenue": ZERO})
            group["count"] += 1
            group["revenue"] += amount
        count, denominator = len(rows), len(cohort["memberIds"])
        output[key] = {
            "eligible_opportunities": denominator,
            "completed_jobs": count,
            "unconverted_opportunities": denominator - len({r["opportunityId"] for r in rows}),
            "net_earned_service_revenue": rendered(revenue),
            "average_net_completed_job_value": None if count == 0 else rendered(revenue / count),
            "revenue_per_eligible_opportunity": rendered(revenue / denominator),
            "completed_opportunity_rate": {"numerator": len({r["opportunityId"] for r in rows}), "denominator": denominator},
            "service_mix": {name: {"completed_jobs": group["count"], "net_earned_service_revenue": rendered(group["revenue"]),
                                   "average_net_completed_job_value": rendered(group["revenue"] / group["count"])}
                            for name, group in sorted(mix.items())},
        }
    comparison = output[scenario["policyInputs"]["comparisonCohortId"]]
    numeric_pass = Decimal(comparison["average_net_completed_job_value"]) >= money(scenario["policyInputs"]["averageTarget"])
    guardrail_pass = Decimal(comparison["revenue_per_eligible_opportunity"]) >= money(scenario["policyInputs"]["revenuePerOpportunityFloor"])
    return {"cohorts": output, "numeric_target_met": numeric_pass, "opportunity_guardrail_passed": guardrail_pass,
            "outcome_verdict": "target_met" if numeric_pass and guardrail_pass else "target_not_met",
            "causal_effect_status": "not_estimated"}


def payment_cohort(scenario, facts):
    cohorts = frozen_cohorts(facts)
    cohort = cohorts[scenario["policyInputs"]["paymentCohortId"]]
    invoices = {e["canonicalFactId"]: e["data"] for e in facts.values() if e["kind"] == "invoice_finalized"}
    as_of = scenario["policyInputs"]["asOf"]
    horizon = scenario["policyInputs"]["paymentHorizonSeconds"]
    delays, closed_delays, censored, balances = {}, {}, {}, {}
    paid_at_horizon = 0
    contact_eligible = []
    financial_result = financial(scenario, facts)
    for key in cohort["memberIds"]:
        if key not in invoices:
            raise FixtureError("Fixed invoice cohort member missing from synthetic inputs")
        invoice = invoices[key]
        cutoff = instant(invoice["issuedAt"]) + timedelta(seconds=horizon)
        if cutoff > instant(as_of):
            raise FixtureError("This payment fixture requires every declared horizon to have matured")
        delays[key] = seconds(invoice["completedAt"], invoice["issuedAt"])
        balances[key] = financial_result["invoice_balances"][key]
        payments = sorted([e["data"] for e in facts.values()
                           if e["kind"] == "settled_payment" and e["data"].get("invoiceId") == key],
                          key=lambda p: p["settledAt"])
        total, full_paid_at = ZERO, None
        for payment in payments:
            if instant(payment["settledAt"]) > instant(as_of):
                raise FixtureError("Payment after the fixture observation cutoff")
            total += money(payment["amount"])
            if total == money(invoice["totalDue"]) and full_paid_at is None:
                full_paid_at = payment["settledAt"]
        if full_paid_at is not None:
            closed_delays[key] = seconds(invoice["issuedAt"], full_paid_at)
            paid_at_horizon += instant(full_paid_at) <= cutoff
        else:
            censored[key] = seconds(invoice["issuedAt"], as_of)
        if Decimal(balances[key]) > ZERO and not invoice["disputed"] and instant(invoice["dueAt"]) < instant(as_of):
            contact_eligible.append(key)
    return {
        "eligible_invoice_count": len(cohort["memberIds"]),
        "completion_to_invoice_delay_seconds": delays,
        "invoice_to_payment_delay_seconds_paid_only": closed_delays,
        "open_observation_age_seconds": censored,
        "paid_by_horizon_rate": {"numerator": paid_at_horizon, "denominator": len(cohort["memberIds"]), "horizon_seconds": horizon},
        "open_invoice_balance": financial_result["open_invoice_balance"],
        "still_open_invoice_count": len(censored),
        "overdue_undisputed_balance_candidate_ids": sorted(contact_eligible),
        "net_collected_cash": financial_result["net_collected_cash"],
        "causal_effect_status": "not_estimated",
    }


def repeat_service(scenario, facts):
    cohort = frozen_cohorts(facts)[scenario["policyInputs"]["repeatCohortId"]]
    repeats, rework, used_jobs = [], [], set()
    for event in facts.values():
        if event["kind"] != "repeat_completion":
            continue
        data = event["data"]
        if data["opportunityId"] not in cohort["memberIds"] or data["jobId"] in used_jobs:
            raise FixtureError("Repeat result outside frozen cohort or duplicated job")
        used_jobs.add(data["jobId"])
        if data["classification"] == "appropriate_repeat_service":
            repeats.append(data)
        elif data["classification"] in {"warranty", "corrective_rework"}:
            rework.append(data)
        else:
            raise FixtureError("Unknown repeat classification")
    agreement_decisions = [e["data"] for e in facts.values() if e["kind"] == "agreement_decision"]
    return {"eligible_repeat_service_completions": len(repeats), "warranty_rework_completion_count": len(rework),
            "eligible_opportunity_count": len(cohort["memberIds"]),
            "without_eligible_repeat_completion_count": len(cohort["memberIds"]) - len({r["opportunityId"] for r in repeats}),
            "without_any_completed_work_count": len(cohort["memberIds"]) - len({r["opportunityId"] for r in repeats + rework}),
            "warranty_rework_variable_cost": rendered(sum((money(r["variableCost"]) for r in rework), ZERO)),
            "warranty_rework_capacity_minutes": sum(r["capacityMinutes"] for r in rework),
            "existing_agreement_renewals": sum(r["decision"] == "renewed" for r in agreement_decisions),
            "new_agreement_acquisitions": sum(r["decision"] == "newly_acquired" for r in agreement_decisions),
            "causal_effect_status": "not_estimated"}


def lifecycle(scenario, facts):
    verdicts = {}
    for event in facts.values():
        if event["kind"] != "mission_evaluation":
            continue
        data = event["data"]
        if instant(scenario["policyInputs"]["asOf"]) < instant(data["maturesAt"]):
            verdict = "pending"
        elif data["observedValue"] is None or any(g["observedValue"] is None for g in data["guardrails"]):
            verdict = "not_evaluable"
        else:
            target_pass = money(data["observedValue"]) >= money(data["target"])
            guards_pass = all(money(g["observedValue"]) >= money(g["floor"]) for g in data["guardrails"])
            verdict = "target_met" if target_pass and guards_pass else "target_not_met"
        verdicts[data["missionRunId"]] = {"workflow_state": data["workflowState"], "outcome_verdict": verdict,
                                           "causal_effect_status": "not_estimated"}
    return {"mission_results": verdicts}


def organization(scenario, facts):
    resolved, unresolved, unknown_stock = 0, 0, 0
    details = {}
    for event in facts.values():
        if event["kind"] != "operational_finding":
            continue
        data = event["data"]
        verified = False
        if data["findingType"] == "estimate_missing_next_action":
            verified = bool(data["assignedActionId"] and data["assignedOwnerId"] and data["validDueAt"])
            if data["validDueAt"]:
                instant(data["validDueAt"])
        elif data["findingType"] == "inventory_unknown":
            unknown_stock += data["verifiedQuantity"] is None
            verified = data["verifiedQuantity"] is not None and bool(data["verificationSourceRef"])
        else:
            raise FixtureError("Unknown finding kind")
        resolved += verified
        unresolved += not verified
        details[event["canonicalFactId"]] = {"resolution_verified": verified, "underlying_business_outcome": data["underlyingBusinessOutcome"]}
    return {"verified_issue_resolutions": resolved, "unresolved_issue_count": unresolved,
            "unknown_inventory_count": unknown_stock, "findings": details}


VIEW_FUNCTIONS = {"financial": financial, "job_value": job_value, "payment_cohort": payment_cohort,
                  "repeat_service": repeat_service, "lifecycle": lifecycle, "organization": organization}


def evaluate(scenario, events):
    if scenario["policyInputs"].get("status") != "fixture_only":
        raise FixtureError("Every example must explicitly declare fixture-only policy")
    if scenario["currency"] != "USD":
        raise FixtureError("This oracle covers scale-2 USD fixtures only; no FX or other currency assumptions")
    ZoneInfo(scenario["policyInputs"]["timeZone"])
    facts = current_facts(scenario, events)
    view = scenario["view"]
    if view not in VIEW_FUNCTIONS:
        raise FixtureError(f"Unknown fixture view {view}")
    result = VIEW_FUNCTIONS[view](scenario, facts)
    # Financial totals stay explicit for operational examples too.
    if view in {"lifecycle", "organization"}:
        result.update({key: value for key, value in financial(scenario, facts).items()
                       if key in {"net_earned_service_revenue", "net_collected_cash", "net_confirmed_bookings"}})
    return result


def assert_expected(actual, expected, context):
    if not expected:
        raise FixtureError(f"{context}: no expected results")
    for key, value in expected.items():
        if key not in actual:
            raise FixtureError(f"{context}: expected key {key!r} is not checked by this oracle")
        if actual[key] != value:
            raise FixtureError(f"{context}.{key}: expected {value!r}, got {actual[key]!r}")


def validate_scenario(scenario):
    events = scenario["events"]
    count = 0
    prior_prefix = 0
    for checkpoint in scenario["checkpoints"]:
        prefix = checkpoint["afterEventCount"]
        if type(prefix) is not int or not prior_prefix < prefix <= len(events):
            raise FixtureError("Checkpoints must increase and stay within the explicit event sequence")
        assert_expected(evaluate(scenario, events[:prefix]), checkpoint["expected"], f"{scenario['id']}/{checkpoint['id']}")
        prior_prefix = prefix
        count += 1
    if prior_prefix != len(events):
        raise FixtureError("Last checkpoint must describe all events")
    return count


def validate_period_checks(scenario):
    count = 0
    for check in scenario.get("periodChecks", []):
        if "utcInstant" in check:
            local = instant(check["utcInstant"]).astimezone(ZoneInfo(check["timeZone"]))
            if (local.isoformat() != check["expectedLocalDateTime"]
                    or local.strftime("%Y-%m") != check["expectedServiceMonth"]):
                raise FixtureError("Local service-month example is inconsistent")
        else:
            alternate = copy.deepcopy(scenario)
            alternate["policyInputs"]["cashMonth"] = check["cashMonth"]
            actual = evaluate(alternate, alternate["events"])
            if actual["net_collected_cash"] != check["expectedNetCollectedCash"]:
                raise FixtureError("Alternate settlement-month cash example is inconsistent")
        count += 1
    return count


def negative_checks(scenarios):
    """Mutations must be rejected; they do not exercise any production consumer."""
    indexed = {s["id"]: s for s in scenarios}
    mutations = []

    bad = copy.deepcopy(indexed["OM-FIN-01"])
    bad["checkpoints"][-1]["expected"]["net_earned_service_revenue"] = "800.00"
    mutations.append(("linked_refund_must_not_reduce_earned_twice", bad))

    bad = copy.deepcopy(indexed["OM-FIN-01"])
    bad["checkpoints"][-1]["expected"]["net_collected_cash"] = "1000.00"
    mutations.append(("refund_must_reduce_net_cash", bad))

    bad = copy.deepcopy(indexed["OM-FIN-01"])
    next(e for e in bad["events"] if e["kind"] == "settled_payment")["data"]["amount"] = 1000.0
    mutations.append(("float_money_rejected", bad))

    bad = copy.deepcopy(indexed["OM-FIN-01"])
    bad["events"][0]["companyId"] = "10000000-0000-4000-8000-000000000002"
    mutations.append(("tenant_contamination_rejected", bad))

    bad = copy.deepcopy(indexed["OM-FIN-01"])
    conflicting = copy.deepcopy(next(e for e in bad["events"] if e["kind"] == "service_allocation"))
    conflicting["eventId"] += ".conflict"
    conflicting["data"]["amount"] = "999.00"
    bad["events"].append(conflicting)
    bad["checkpoints"][-1]["afterEventCount"] = len(bad["events"])
    mutations.append(("same_fact_version_conflict_rejected", bad))

    bad = copy.deepcopy(indexed["OM-FIN-08"])
    bad["checkpoints"][-1]["expected"]["earned_agreement_revenue"] = "1200.00"
    mutations.append(("missing_recognition_cannot_be_immediate_revenue", bad))

    bad = copy.deepcopy(indexed["OM-FIN-14"])
    next(e for e in bad["events"] if e["kind"] == "cohort_frozen")["data"]["memberIds"].pop()
    mutations.append(("frozen_denominator_cannot_drop_nonconverter", bad))

    bad = copy.deepcopy(indexed["OM-FIN-10"])
    bad["checkpoints"][-1]["expected"]["contribution_before_fixed_overhead"] = "820.00"
    mutations.append(("partial_cost_remainder_is_not_complete_contribution", bad))

    rejected = []
    for name, scenario in mutations:
        try:
            validate_scenario(scenario)
        except FixtureError:
            rejected.append(name)
        else:
            raise FixtureError(f"Negative mutation unexpectedly passed: {name}")
    return rejected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", nargs="?", type=Path,
                        default=Path(__file__).resolve().parents[1] / "fixtures" / "accounting-examples.json")
    args = parser.parse_args()
    document = json.loads(args.fixture.read_text())
    if document["artifactKind"] != "synthetic_accounting_examples" or document["runtimeAcceptance"] != "not_executed":
        raise FixtureError("This validator accepts preparation fixtures only")
    scenarios = document["scenarios"]
    if len({s["id"] for s in scenarios}) != len(scenarios):
        raise FixtureError("Scenario IDs must be unique")
    checkpoints, reorders, replays, period_checks = 0, 0, 0, 0
    for scenario in scenarios:
        checkpoints += validate_scenario(scenario)
        period_checks += validate_period_checks(scenario)
        events = scenario["events"]
        final = evaluate(scenario, events)
        # Three named orderings, not every permutation. Final-state arithmetic only.
        for changed in [list(reversed(events)), sorted(events, key=lambda e: (e["canonicalFactId"], e["sourceVersion"])), events[1:] + events[:1]]:
            if evaluate(scenario, changed) != final:
                raise FixtureError(f"{scenario['id']}: final arithmetic depends on arrival order")
            reorders += 1
        if evaluate(scenario, events + copy.deepcopy(events)) != final:
            raise FixtureError(f"{scenario['id']}: exact event replay changes arithmetic")
        replays += 1
        redelivery = copy.deepcopy(events)
        for event in redelivery:
            event["eventId"] += ".redelivery"
        if evaluate(scenario, events + redelivery) != final:
            raise FixtureError(f"{scenario['id']}: repeated source revision changes arithmetic")
        replays += 1
    rejected = negative_checks(scenarios)
    print(json.dumps({
        "status": "passed", "scope": "synthetic_fixture_consistency_only",
        "scenarios": len(scenarios), "checkpoints": checkpoints,
        "supplemental_local_period_checks": period_checks,
        "selected_final_state_reorder_checks": reorders, "final_state_replay_checks": replays,
        "negative_mutations_rejected": len(rejected), "negative_mutation_names": rejected,
        "production_behavior_tested": False, "runtime_acceptance": "not_executed",
    }, indent=2))


if __name__ == "__main__":
    main()
