"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AccountDataPage() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/account/data");
      if (!res.ok) throw new Error("Не удалось выгрузить данные");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "personal-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/data", { method: "DELETE" });
      if (!res.ok) throw new Error("Не удалось удалить данные");
      toast.success("Данные удалены");
      setConfirmOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">Мои данные</h1>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Выгрузка персональных данных</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Согласно 152-ФЗ вы можете получить копию своих персональных данных в
              машиночитаемом формате (JSON).
            </p>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4" /> Выгрузить данные
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-destructive">Удаление данных</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Удаление деперсонализирует ваш профиль, клиентские записи и согласия.
              Данные заказов сохраняются обезличенно в соответствии с требованиями
              бухгалтерского учёта.
            </p>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" /> Удалить мои данные
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить персональные данные?</DialogTitle>
            <DialogDescription>
              Действие необратимо. Вы потеряете доступ к истории заказов.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
