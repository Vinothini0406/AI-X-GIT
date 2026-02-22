export const clerkAppearance = {
  variables: {
    colorPrimary: "#0f766e",
    colorText: "#0f172a",
    colorTextSecondary: "#334155",
    colorBackground: "transparent",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f172a",
    borderRadius: "0.85rem",
    fontFamily: "var(--font-space-grotesk)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "w-full border-0 bg-transparent shadow-none p-0",
    headerTitle: "text-xl font-semibold tracking-tight text-slate-900",
    headerSubtitle: "text-sm text-slate-500",
    socialButtonsBlockButton:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors",
    dividerLine: "bg-slate-200",
    dividerText: "text-slate-500 text-xs",
    formFieldLabel: "text-slate-600",
    formFieldInput:
      "h-11 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
    footerActionText: "text-slate-500",
    footerActionLink: "text-teal-700 hover:text-teal-800",
    formButtonPrimary:
      "h-11 rounded-xl bg-teal-700 text-white hover:bg-teal-800 shadow-lg shadow-teal-700/20 transition-colors",
    identityPreviewText: "text-slate-600",
    identityPreviewEditButton:
      "text-teal-700 hover:text-teal-800 hover:bg-teal-50",
    otpCodeFieldInput:
      "h-11 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
    alertText: "text-red-700",
  },
} as const;
