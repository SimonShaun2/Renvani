import { Redis } from "ioredis";

import { coreEnv as env } from "@fsm/config/runtime-env";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});
