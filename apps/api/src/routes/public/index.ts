import type { FastifyPluginAsync } from "fastify";

import publicBookingRoutes from "./booking/index.js";
import publicCustomerPortalRoutes from "./customer-portal/index.js";
import publicMarketingRoutes from "./marketing/index.js";
import publicEstimateRoutes from "./estimates/index.js";
import publicAgreementRoutes from "./agreements/index.js";
import publicPayRoutes from "./pay/index.js";
import publicReviewRoutes from "./reviews/index.js";
import publicSiteRoutes from "./site/index.js";
import publicVipRoutes from "./vip/index.js";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(publicBookingRoutes, { prefix: "/booking" });
  await fastify.register(publicEstimateRoutes, { prefix: "/estimates" });
  await fastify.register(publicPayRoutes, { prefix: "/pay" });
  await fastify.register(publicAgreementRoutes, { prefix: "/agreements" });
  await fastify.register(publicReviewRoutes, { prefix: "/reviews" });
  await fastify.register(publicVipRoutes, { prefix: "/vip" });
  await fastify.register(publicSiteRoutes, { prefix: "/site" });
  await fastify.register(publicCustomerPortalRoutes, { prefix: "/customer-portal" });
  await fastify.register(publicMarketingRoutes, { prefix: "/marketing" });
};

export default publicRoutes;
