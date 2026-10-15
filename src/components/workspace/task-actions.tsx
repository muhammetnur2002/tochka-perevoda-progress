"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTaskStatusAction } from "@/app/workspace/actions";
import { uploadOrderFile } from "@/lib/client/api";

interface TaskActionsProps {
  assignmentId: string;
  orderId: string;
  status: string;
  role: string;
}

/** Действия исполнителя: взять в работу, загрузить перевод, сдать, отказаться. */
export function TaskActions({ assignmentId, orderId, status, role }: TaskActionsProps) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const closed = status === "done" || status === "rejected";

  const setStatus = (s: "accepted" | "in_progress" | "done" | "rejected") =>
    start(async () => {
      const r = await setTaskStatusAction(assignmentId, s);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadOrderFile(orderId, f, { kind: "translation" });
      toast.success("Перевод загружен");
      if (status === "assigned" || status === "accepted") await setTaskStatusAction(assignmentId, "in_progress");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (closed) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">
        {status === "done" ? "Задача сдана. Менеджер получил уведомление." : "Вы отказались от задачи."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {role === "translator" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center ${dragOver ? "border-gold-400 bg-gold-50" : "border-slate-300 bg-slate-50"}`}
        >
          <UploadCloud className="h-8 w-8 text-brand-500" aria-hidden />
          <p className="font-bold text-brand-800">Перетащите файл перевода (DOCX, PDF)</p>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : "Выбрать файл"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".doc,.docx,.pdf,.zip"
            className="sr-only"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2.5 border-t pt-4">
        {status === "assigned" && (
          <Button onClick={() => setStatus("in_progress")} disabled={pending}>
            Взять в работу
          </Button>
        )}
        <Button variant="gold" onClick={() => setStatus("done")} disabled={pending}>
          Готово — передать менеджеру
        </Button>
        <Button
          variant="outline"
          className="text-red-700"
          disabled={pending}
          onClick={() => window.confirm("Отказаться от задачи? Менеджер назначит другого исполнителя.") && setStatus("rejected")}
        >
          Отказаться
        </Button>
      </div>
    </div>
  );
}
