import Stripe from "stripe";

import { env } from "@fsm/config";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
