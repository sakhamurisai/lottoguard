"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const ALERTS_KEY = "lg_emp_alerts";

type AlertEntry = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  timestamp: string;
};

function loadAlerts(sub: string): AlertEntry[] {
  try {
    const raw = localStorage.getItem(`${ALERTS_KEY}_${sub}`);
    return raw ? (JSON.parse(raw) as AlertEntry[]) : [];
  } catch { return []; }
}

function saveAlerts(sub: string, alerts: AlertEntry[]) {
  try {
    localStorage.setItem(`${ALERTS_KEY}_${sub}`, JSON.stringify(alerts));
  } catch { /* storage full */ }
}

function fmtAlertTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function EmployeeAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    setAlerts(loadAlerts(user.id));
  }, [user?.id]);

  function clearAll() {
    if (!user?.id) return;
    saveAlerts(user.id, []);
    setAlerts([]);
  }

  function dismiss(id: string) {
    const next = alerts.filter((a) => a.id !== id);
    setAlerts(next);
    if (user?.id) saveAlerts(user.id, next);
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Alerts &amp; Notifications</h1>
        {alerts.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <div className="size-14 rounded-full bg-muted flex items-center justify-center">
            <Bell className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Alerts from your shifts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
                a.severity === "error"   && "bg-red-50 border-red-200 text-red-800",
                a.severity === "warning" && "bg-amber-50 border-amber-200 text-amber-800",
                a.severity === "info"    && "bg-blue-50 border-blue-200 text-blue-800",
              )}
            >
              <AlertTriangle
                className={cn(
                  "size-4 shrink-0 mt-0.5",
                  a.severity === "error"   && "text-red-500",
                  a.severity === "warning" && "text-amber-500",
                  a.severity === "info"    && "text-blue-500",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="leading-snug">{a.message}</p>
                <p className="text-xs opacity-60 mt-1">{fmtAlertTime(a.timestamp)}</p>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
