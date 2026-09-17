/** Mirrors the server's system field keys for each record type. */
export const SYSTEM_TITLE_KEY = 'leadName';
export const SYSTEM_STATUS_KEY = 'leadStatus';

export const SYSTEM_CUSTOMER_TITLE_KEY = 'customerName';
export const SYSTEM_CUSTOMER_STATUS_KEY = 'customerStatus';

export const TITLE_KEY_BY_ENTITY = { lead: SYSTEM_TITLE_KEY, customer: SYSTEM_CUSTOMER_TITLE_KEY };
export const STATUS_KEY_BY_ENTITY = { lead: SYSTEM_STATUS_KEY, customer: SYSTEM_CUSTOMER_STATUS_KEY };
