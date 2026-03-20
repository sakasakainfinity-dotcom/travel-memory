import "server-only";

import Stripe from "stripe";
import { getStripeEnv } from "./env";

export function getStripeServer() {
  const { secretKey } = getStripeEnv();
  return new Stripe(secretKey);
}
