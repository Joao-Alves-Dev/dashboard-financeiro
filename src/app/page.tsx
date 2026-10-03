import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("app");
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("nome")}</h1>
    </main>
  );
}
