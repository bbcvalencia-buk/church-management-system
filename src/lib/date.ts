export const toISODateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getLatestSundayDate = (baseDate: Date = new Date()): Date => {
    const d = new Date(baseDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
};

export const getLatestSundayISODate = (baseDate: Date = new Date()): string =>
    toISODateLocal(getLatestSundayDate(baseDate));

export const getPreviousSundayISODate = (baseDate: Date = new Date()): string => {
    const latestSunday = getLatestSundayDate(baseDate);
    latestSunday.setDate(latestSunday.getDate() - 7);
    return toISODateLocal(latestSunday);
};
