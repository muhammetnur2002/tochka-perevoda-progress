import { NextResponse } from "next/server";
import { getLanguages, getOffices, getPublicSettings, getServices } from "@/lib/services/catalog";
import { errorBody, errorStatus } from "@/lib/errors";

// Каталог читается из БД на каждый запрос (кэш — на CDN/прокси по Cache-Control),
// иначе Next «запёк» бы ответ на этапе сборки.
export const dynamic = "force-dynamic";

/**
 * GET /api/services — каталог услуг, языков и публичных настроек.
 * Используется калькулятором, каталогом и корзиной.
 */
export async function GET() {
  try {
    const [services, languages, offices, settings] = await Promise.all([
      getServices(),
      getLanguages(),
      getOffices(),
      getPublicSettings(),
    ]);

    return NextResponse.json(
      { services, languages, offices, settings },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(errorBody(err), { status: errorStatus(err) });
  }
}
