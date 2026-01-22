import { useState } from "react";
import { SITE_NAV_LINKS } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { BRAND_ACCENT_TEXT, BRAND_PRIMARY_TEXT } from "@/constants/theme";

export interface SiteHeaderUser {
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
}

export interface SiteHeaderProps {
  cartCount?: number;
  currentPath?: string;
  onNavigate?: (href: string) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  isAuthenticated?: boolean;
  user?: SiteHeaderUser;
  onLogout?: () => void;
  onLoginClick?: () => void;
  className?: string;
}

export function SiteHeader({
  cartCount = 0,
  currentPath,
  onNavigate,
  searchQuery = "",
  onSearchChange,
  showSearch = true,
  isAuthenticated = false,
  user,
  onLogout,
  onLoginClick,
  className,
}: SiteHeaderProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleNavigate = (href: string) => {
    onNavigate?.(href);
    setIsMobileOpen(false);
  };

  const isActive = (href: string) => {
    if (!currentPath) {
      return href === "/";
    }
    if (href === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(href);
  };

  const initials =
    user?.initials ||
    user?.name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <header className={cn("border-b border-gray-100/50 pb-4", className)}>
      <div className="flex items-center gap-4">
        <div className="font-extrabold text-2xl tracking-tight text-gray-900">
          Otto
          <i className={cn(BRAND_ACCENT_TEXT, "not-italic")}>learn</i>{" "}
          <em className={cn(BRAND_PRIMARY_TEXT, "not-italic")}>◈</em>
        </div>

        <nav className="hidden items-center gap-5 text-gray-700 lg:flex ml-auto">
          {SITE_NAV_LINKS.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => handleNavigate(link.href)}
              className={cn(
                "relative pb-1 text-sm font-semibold transition-colors",
                isActive(link.href)
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-900",
              )}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              <span className="inline-flex items-center gap-2">
                {link.label}
                {link.key === "cart" && cartCount > 0 ? (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-100 px-1 text-xs font-bold text-rose-600">
                    {cartCount}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "absolute left-0 -bottom-1 h-0.5 w-full rounded-full bg-[#0ea5a7] transition-opacity",
                  isActive(link.href) ? "opacity-100" : "opacity-0",
                )}
                aria-hidden="true"
              />
            </button>
          ))}
        </nav>
        <div
          className={cn(
            "ml-4 hidden w-[260px] items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-2 text-sm transition-all duration-300 lg:flex",
            showSearch ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none",
          )}
          aria-hidden={!showSearch}
        >
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            id="site-search"
            type="search"
            placeholder="Search"
            aria-label="Search courses"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            className="h-auto min-w-[180px] border-none bg-transparent p-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            tabIndex={showSearch ? 0 : -1}
          />
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-900 shadow-md backdrop-blur-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5a7]/40 sm:flex"
                  title="Account menu"
                >
                  <Avatar className="h-8 w-8 bg-gray-200">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} referrerPolicy="no-referrer" />
                    ) : (
                      <AvatarFallback className="text-sm font-semibold text-[#0ea5a7]">
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span>{user.name}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60" sideOffset={8}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold leading-none">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                  onSelect={onLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={onLoginClick}
              className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-md backdrop-blur-sm transition hover:bg-gray-100 sm:flex"
              variant="outline"
            >
              <LogIn className="h-4 w-4 text-gray-900" />
              Sign in
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {isMobileOpen ? (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 lg:hidden">
          {showSearch ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(event) => onSearchChange?.(event.target.value)}
                className="h-10 rounded-full border-gray-200 bg-gray-100 pl-10"
              />
            </div>
          ) : null}

          <nav className="flex flex-col gap-1 text-gray-700">
            {SITE_NAV_LINKS.map((link) => (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNavigate(link.href)}
                className={cn(
                  "flex items-center justify-between py-1 text-base font-semibold",
                  isActive(link.href) ? "text-gray-900" : "text-gray-600",
                )}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                <span>{link.label}</span>
                {link.key === "cart" && cartCount > 0 ? (
                  <span className="text-sm text-gray-500">({cartCount})</span>
                ) : null}
              </button>
            ))}

            {isAuthenticated ? (
              <Button
                variant="ghost"
                className="mt-2 justify-start gap-2 p-0 text-destructive hover:bg-transparent hover:text-destructive"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="mt-2 justify-start gap-2 p-0"
                onClick={onLoginClick}
              >
                <LogIn className="h-4 w-4" />
                Login / Sign up
              </Button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
