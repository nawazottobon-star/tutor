export type SiteNavLink = {
  key: "home" | "cart" | "courses" | "tutor" | "about";
  label: string;
  href: string;
};

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { key: "home", label: "Home", href: "/" },
];
