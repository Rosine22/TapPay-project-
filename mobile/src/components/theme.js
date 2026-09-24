export const colors = {
  ink: '#16202F',
  inkSoft: '#2B3A52',
  page: '#F3F5F8',
  card: '#FFFFFF',
  line: '#DFE4EC',
  muted: '#6B7A90',
  signal: '#FFBE3D',
  signalInk: '#221A05',
  go: '#118C5B',
  stop: '#C4443A',
};

export const money = (amount) => new Intl.NumberFormat('en-RW').format(Number(amount || 0));

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' }) +
  ' · ' +
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
