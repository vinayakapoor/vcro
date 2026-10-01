import { Fragment, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ChevronDown, ChevronRight, ChevronsUpDown, Globe, Sparkles, Sun, Moon, Monitor } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePrefs, type Theme } from "@/features/shared/prefs";
import { getPerson, pseudonym, useSignals } from "@/lib/api";
import { AFTER_VCRO, BEFORE_VCRO, PLATFORM_PAGES, VCRO_ICON, VCRO_ORDER, VCRO_PAGES, type PlatformItem } from "./nav";
import { AskAi } from "./ask-ai";

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="text-lg font-bold italic tracking-tight">
        <span className="text-foreground">Human</span><span className="text-brand">Firewall</span>
      </span>
      <span className="h-7 w-px bg-border" aria-hidden />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold">AI</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">Beta</span>
      </span>
    </div>
  );
}

function PlatformLink({ item, active }: { item: PlatformItem; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link to="/$section" params={{ section: item.slug }}>
          <item.icon className="size-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function useCrumbs(path: string): string[] {
  const signals = useSignals();
  const { privacy } = usePrefs();
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "vcro") return ["Dashboard", PLATFORM_PAGES[parts[0] ?? "home"] ?? "Home"];
  const label = VCRO_ORDER.find((v) => v.page === parts[1] || v.to === `/vcro/${parts[1]}`)?.label ?? VCRO_PAGES[parts[1] ?? ""] ?? "Riskometer";
  const out = ["Dashboard", "vCRO", label];
  if (parts[1] === "people" && parts[2]) {
    const p = getPerson(signals, parts[2]);
    if (p) out.push(privacy ? pseudonym(p.id) : p.name);
  }
  return out;
}

const THEME_ICON: Record<Theme, ReactNode> = { light: <Sun className="size-4" />, dark: <Moon className="size-4" />, system: <Monitor className="size-4" /> };

export function AppShell({ children }: { children: ReactNode }) {
  const { setAskOpen, theme, setTheme } = usePrefs();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = useCrumbs(path);
  const seg = path.split("/").filter(Boolean);
  const inVcro = seg[0] === "vcro";

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="gap-3 px-3 pt-4">
            <div className="group-data-[collapsible=icon]:hidden"><Wordmark /></div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" className="border" tooltip="Demo Enterprise">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background"><Building2 className="size-4" /></span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">Demo Enterprise</span>
                    <span className="truncate text-xs text-muted-foreground">Demo Enterprise</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider">Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {BEFORE_VCRO.map((i) => <PlatformLink key={i.slug} item={i} active={seg[0] === i.slug} />)}
                  <Collapsible defaultOpen asChild className="group/vcro">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="vCRO" isActive={inVcro && false}>
                          <VCRO_ICON className="size-4" />
                          <span>vCRO</span>
                          <span className="rounded border px-1 text-[10px] font-semibold uppercase leading-4 text-muted-foreground">New</span>
                          <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/vcro:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {VCRO_ORDER.map((v) => {
                            const active = v.page ? seg[1] === v.page : path.startsWith(v.to);
                            return (
                              <SidebarMenuSubItem key={v.label}>
                                <SidebarMenuSubButton asChild isActive={active}>
                                  {v.page ? (
                                    <Link to="/vcro/$page" params={{ page: v.page }}>{v.label}</Link>
                                  ) : (
                                    <Link to={v.to as "/vcro/riskometer"}>{v.label}</Link>
                                  )}
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                  {AFTER_VCRO.map((i) => <PlatformLink key={i.slug} item={i} active={seg[0] === i.slug} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="px-3 pb-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" tooltip="Vinayak Kapoor">
                      <Avatar className="size-8"><AvatarFallback className="text-xs">VK</AvatarFallback></Avatar>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-semibold">Vinayak Kapoor</span>
                        <span className="truncate text-xs text-muted-foreground">vinayak.kapoor@demoenterprise.com</span>
                      </span>
                      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start">
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
            <div className="px-2 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">v3.0.0-beta</div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <span className="h-4 w-px bg-border" aria-hidden />
            <Breadcrumb className="min-w-0 truncate">
              <BreadcrumbList>
                {crumbs.map((c, i) => (
                  <Fragment key={i}>
                    {i > 0 && <BreadcrumbSeparator className={i < crumbs.length - 1 ? "hidden md:block" : "hidden md:block"} />}
                    <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden md:inline-flex" : "truncate"}>
                      {i === crumbs.length - 1 ? <BreadcrumbPage>{c}</BreadcrumbPage>
                        : c === "Dashboard" ? <BreadcrumbLink asChild><Link to="/$section" params={{ section: "home" }}>{c}</Link></BreadcrumbLink>
                        : c === "vCRO" ? <BreadcrumbLink asChild><Link to="/vcro/riskometer">{c}</Link></BreadcrumbLink>
                        : c === "People" ? <BreadcrumbLink asChild><Link to="/vcro/people">{c}</Link></BreadcrumbLink>
                        : <span>{c}</span>}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" aria-label="Language"><Globe className="size-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem>English</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setAskOpen(true)}><Sparkles className="size-4" /><span className="hidden sm:inline">Ask AI</span></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Theme">{THEME_ICON[theme]}<span className="hidden sm:inline">Theme</span><ChevronDown className="size-3.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                    <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
        <AskAi />
      </SidebarProvider>
    </TooltipProvider>
  );
}
