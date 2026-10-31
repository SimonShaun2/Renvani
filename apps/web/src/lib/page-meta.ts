export interface PageMeta {
  title: string;
  subtitle: string;
}

const DEFAULT_META: PageMeta = {
  title: "Renvani",
  subtitle: "Thinner system. Smarter brain."
};

const STATIC_PAGE_META: Array<{ prefix: string; meta: PageMeta }> = [
  {
    prefix: "/dashboard",
    meta: {
      title: "Dashboard",
      subtitle: "Find the next revenue move before it slips."
    }
  },
  {
    prefix: "/dispatch",
    meta: {
      title: "Dispatch Board",
      subtitle: "Keep the field full and the gaps short."
    }
  },
  {
    prefix: "/customers",
    meta: {
      title: "Customers",
      subtitle: "Track every property, asset, and relationship."
    }
  },
  {
    prefix: "/jobs",
    meta: {
      title: "Jobs",
      subtitle: "Move work from lead to paid without extra friction."
    }
  },
  {
    prefix: "/estimates",
    meta: {
      title: "Estimates",
      subtitle: "Quote faster and surface smarter upsell paths."
    }
  },
  {
    prefix: "/invoices",
    meta: {
      title: "Invoices",
      subtitle: "Send, collect, and recover revenue in one flow."
    }
  },
  {
    prefix: "/payments",
    meta: {
      title: "Payments",
      subtitle: "Collections, payouts, and disputes at a glance."
    }
  },
  {
    prefix: "/service-agreements",
    meta: {
      title: "Service Agreements",
      subtitle: "Keep recurring work and renewals in motion."
    }
  },
  {
    prefix: "/ai-revenue-center",
    meta: {
      title: "AI Revenue Center",
      subtitle: "See where the hidden money is and act in one click."
    }
  },
  {
    prefix: "/products",
    meta: {
      title: "Product Catalog",
      subtitle: "Control the catalog behind every quote, job, and invoice."
    }
  },
  {
    prefix: "/inventory",
    meta: {
      title: "Inventory",
      subtitle: "Parts on hand across your warehouse and service trucks."
    }
  },
  {
    prefix: "/review-requests",
    meta: {
      title: "Review Requests",
      subtitle: "Turn finished jobs into public proof."
    }
  },
  {
    prefix: "/reporting",
    meta: {
      title: "Reporting",
      subtitle: "Keep a clean pulse on jobs, cash, and conversions."
    }
  },
  {
    prefix: "/settings",
    meta: {
      title: "Settings",
      subtitle: "Tune the rules that run your operation."
    }
  },
  {
    prefix: "/mobile",
    meta: {
      title: "Field App",
      subtitle: "Give technicians the next best action in the field."
    }
  }
];

export function getPageMeta(pathname: string): PageMeta {
  const match = STATIC_PAGE_META.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return match?.meta ?? DEFAULT_META;
}
