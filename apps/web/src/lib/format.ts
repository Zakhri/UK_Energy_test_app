export const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return iso;
  }
};

export const formatDateTime = (iso: string): string => `${formatDate(iso)} ${formatTime(iso)}`;

export const formatNumber = (value: number, decimals = 0): string =>
  value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatPounds = (value: number, decimals = 2): string =>
  `£${formatNumber(value, decimals)}`;
