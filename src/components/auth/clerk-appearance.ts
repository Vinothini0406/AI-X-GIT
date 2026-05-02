export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
  },
  variables: {
    colorPrimary: "#111111",
    colorText: "#111111",
    colorTextSecondary: "#6b7280",
    colorBackground: "transparent",
    colorInputBackground: "#ffffff",
    colorInputText: "#111111",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-space-grotesk)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "w-full border-0 bg-transparent shadow-none p-0",
    headerTitle: "text-xl font-semibold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButton:
      "h-11 rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
    formFieldLabel: "text-muted-foreground",
    formFieldInput:
      "h-11 rounded-md border border-border bg-background text-foreground shadow-none focus:border-foreground focus:ring-2 focus:ring-muted",
    footerActionText: "text-muted-foreground",
    footerActionLink: "text-foreground hover:text-foreground",
    formButtonPrimary:
      "h-11 rounded-md bg-foreground text-background hover:bg-foreground/90 shadow-none transition-colors",
    identityPreviewText: "text-muted-foreground",
    identityPreviewEditButton:
      "text-foreground hover:text-foreground hover:bg-muted",
    otpCodeFieldInput:
      "h-11 rounded-md border border-border bg-background text-foreground shadow-none focus:border-foreground focus:ring-2 focus:ring-muted",
    alertText: "text-destructive",
  },
} as const;
