import Stripe from "stripe";

import { webhookEnv as env } from "@fsm/config/runtime-env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
