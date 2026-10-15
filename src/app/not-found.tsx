import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center py-24 text-center">
      <p className="text-7xl font-bold text-gold-400">404</p>
      <h1 className="mb-2 mt-4 text-2xl font-bold text-brand-900">Страница не найдена</h1>
      <p className="mb-6 text-muted-foreground">Запрошенная страница не существует или была перемещена.</p>
      <Button asChild variant="gold">
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
