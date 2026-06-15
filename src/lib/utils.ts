export const getCurrentTehran = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
export const formatPersianDate = (date: Date | string) => new Date(date).toLocaleDateString('fa-IR');
export const calculateSoilMoisturePercent = (raw: number | null, dry: number, wet: number) => { /* ... */ };
export const calculateTankLevel = (dist: number | null, height: number, cap: number) => { /* ... */ };
export const getFarmStatus = (soil: number, temp: number, tank: number) => { /* ... */ };
export const getFarmStatusText = (status: string) => ({ excellent: 'عالی', good: 'خوب', warning: 'هشدار', critical: 'بحرانی' }[status] || '');
export const generateIrrigationRecommendation = (soil: number, forecast: any, tank: number) => { /* ... */ };
// توابع دیگر مثل evaluateRule, checkAlertRule, ... به همان صورت قبلی
