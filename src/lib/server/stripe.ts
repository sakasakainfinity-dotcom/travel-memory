import "server-only";

import Stripe from "stripe";
import { getRequiredStripeSecretKey } from "./env";

export function getStripeServer() {
  return new Stripe(getRequiredStripeSecretKey());
}
