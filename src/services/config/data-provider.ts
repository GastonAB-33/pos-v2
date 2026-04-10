export type DataProvider = "mock" | "supabase";

const rawProvider = import.meta.env.VITE_DATA_PROVIDER;

export const dataProvider: DataProvider = rawProvider === "supabase" ? "supabase" : "mock";
export const isMockDataProvider = dataProvider === "mock";