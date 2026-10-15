/** Who a policy is for, in words. */
export const describeAudience = (policy) => (policy.departments?.length ? policy.departments.join(', ') : 'Everyone');
