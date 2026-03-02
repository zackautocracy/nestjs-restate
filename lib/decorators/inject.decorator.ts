import { Inject } from "@nestjs/common";
import { RESTATE_CLIENT } from "../restate.constants";

/** Injects the Restate Ingress client for calling workflows/services/objects. */
export const InjectClient = () => Inject(RESTATE_CLIENT);
