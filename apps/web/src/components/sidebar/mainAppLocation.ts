import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/** Settings and Usage open as modals over the last main-app view. */
export function isAppModalPage(pathname: string) {
  return pathname === "/settings" || pathname.startsWith("/settings/") || pathname === "/usage";
}

export function isSidebarUtilityPage(pathname: string) {
  return pathname.startsWith("/projects/") || pathname === "/pull-requests";
}

let mainAppHref: string | null = null;
let appModalReturnHref: string | null = null;

export function MainAppLocationTracker() {
  const href = useLocation({ select: (location) => location.href });
  const pathname = useLocation({ select: (location) => location.pathname });
  useEffect(() => {
    if (isAppModalPage(pathname)) return;
    appModalReturnHref = href;
    if (!isSidebarUtilityPage(pathname)) mainAppHref = href;
  }, [href, pathname]);
  return null;
}

/** The path of the last main-app page, for views that follow it from Settings or Usage. */
export function lastMainAppPathname(): string | null {
  return mainAppHref === null ? null : (mainAppHref.split(/[?#]/)[0] ?? null);
}

export function useNavigateToMainApp() {
  const navigate = useNavigate();
  return () => navigate({ href: mainAppHref ?? "/" });
}

/** Leaves Settings or Usage for the page that opened it. */
export function useCloseAppModal() {
  const navigate = useNavigate();
  return () => navigate({ href: appModalReturnHref ?? mainAppHref ?? "/" });
}
