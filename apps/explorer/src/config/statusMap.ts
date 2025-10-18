import statusConfig from '~/configs/ui/status-map.json';
import saasBillingStatusMap from '~/tokens/maps/saas-billing.status-map.json';

type StatusMapConfig = typeof statusConfig;

export type BillingDomain = keyof StatusMapConfig['domains'];
export type BillingContext = keyof StatusMapConfig['contexts'];

type DomainDefinition = StatusMapConfig['domains'][BillingDomain];

const tokenDomains = saasBillingStatusMap.domains as Record<string, Record<string, unknown>>;

const statusesByDomain = Object.fromEntries(
  (Object.entries(statusConfig.domains) as Array<[BillingDomain, DomainDefinition]>).map(([domain, definition]) => {
    const manifest = tokenDomains[domain];
    if (!manifest) {
      throw new Error(`Status map config references unknown domain "${domain}" in token manifest.`);
    }

    const statuses = definition.statuses ?? [];
    if (statuses.length === 0) {
      throw new Error(`Status map config must declare at least one status for domain "${domain}".`);
    }

    const missing = statuses.filter((status) => !(status in manifest));
    if (missing.length > 0) {
      throw new Error(
        `Status map config lists statuses not present in token manifest for domain "${domain}": ${missing.join(', ')}`
      );
    }

    return [domain, [...statuses]];
  })
) as Record<BillingDomain, string[]>;

const contextDomains = Object.fromEntries(
  (Object.entries(statusConfig.contexts) as Array<[BillingContext, string[]]>).map(([context, domains]) => {
    const aligned = domains.filter((domain): domain is BillingDomain => domain in statusesByDomain);
    if (aligned.length === 0) {
      throw new Error(`Status map config lists no valid domains for context "${context}".`);
    }

    return [context, aligned];
  })
) as Record<BillingContext, BillingDomain[]>;

export const getStatusIds = (domain: BillingDomain): readonly string[] => {
  const statuses = statusesByDomain[domain];
  if (!statuses || statuses.length === 0) {
    throw new Error(`No statuses registered for domain "${domain}".`);
  }
  return statuses;
};

export const getContextDomains = (context: BillingContext): readonly BillingDomain[] => {
  const domains = contextDomains[context];
  if (!domains || domains.length === 0) {
    throw new Error(`Context "${context}" is not mapped to any status domains.`);
  }
  return domains;
};

export const ensureDomainInContext = (context: BillingContext, domain: BillingDomain): void => {
  if (!getContextDomains(context).includes(domain)) {
    throw new Error(`Domain "${domain}" is not registered for context "${context}" in the status map.`);
  }
};

export const pickStatusByIndex = (domain: BillingDomain, index: number): string => {
  const statuses = getStatusIds(domain);
  if (Number.isNaN(index) || index <= 0) {
    return statuses[0];
  }

  if (index >= statuses.length) {
    return statuses[statuses.length - 1];
  }

  return statuses[index];
};

export const selectStatuses = (
  context: BillingContext,
  domain: BillingDomain,
  indices: readonly number[]
): string[] => {
  ensureDomainInContext(context, domain);
  return indices.map((index) => pickStatusByIndex(domain, index));
};

export const statusConfigVersion = statusConfig.version;
export const statusConfigGeneratedAt = statusConfig.generated_at;
