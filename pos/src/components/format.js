export const money = (amount) => new Intl.NumberFormat('en-RW').format(amount);

export const time = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
