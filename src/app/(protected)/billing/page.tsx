"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  Download,
  Loader2,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type StepKey = "plan" | "summary" | "payment" | "invoice";
type CheckoutState = "waiting" | "verifying" | "success";

interface PlanOption {
  key: "starter" | "pro" | "enterprise";
  name: string;
  priceInPaise: number | null;
  highlights: string[];
  featured?: boolean;
}

interface PaymentMethodOption {
  id: string;
  type: "upi" | "card";
  brand: string;
  label: string;
  meta: string;
  simulateFailure: boolean;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "upi_primary",
    type: "upi",
    brand: "UPI",
    label: "Scan & Pay",
    meta: "dionysus.payments@upi",
    simulateFailure: false,
  },
  {
    id: "card_primary",
    type: "card",
    brand: "Card",
    label: "Saved card",
    meta: "xxxx xxxx xxxx 4242",
    simulateFailure: false,
  },
];

const plans: PlanOption[] = [
  {
    key: "starter",
    name: "Starter",
    priceInPaise: 149900,
    highlights: ["5 projects", "150 commit summaries", "Basic AI support"],
  },
  {
    key: "pro",
    name: "Pro",
    priceInPaise: 499900,
    featured: true,
    highlights: ["Unlimited projects", "1,000 commit summaries", "Priority AI support"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceInPaise: null,
    highlights: ["SAML & SOC2 workflows", "Dedicated model tuning", "SLA and support"],
  },
];

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const formatInr = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

const stepLabel: Record<StepKey, string> = {
  plan: "Plan Selection",
  summary: "Checkout Summary",
  payment: "Payment",
  invoice: "Invoice",
};

const BillingPage = () => {
  const { projectId, project } = useProject();

  const [selectedPlanKey, setSelectedPlanKey] = useLocalStorage<"starter" | "pro">(
    "dionysus-billing-selected-plan",
    "pro",
  );
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useLocalStorage<string>(
    "dionysus-billing-payment-method",
    paymentMethods[0]?.id ?? "",
  );
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("waiting");
  const [checkoutMessage, setCheckoutMessage] = useState("Waiting for payment confirmation.");

  const [highlightPlans, setHighlightPlans] = useState(false);
  const [highlightSummary, setHighlightSummary] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("plan");

  const [qrNonce, setQrNonce] = useState(() => `${Date.now()}`);
  const [qrCountdown, setQrCountdown] = useState(60);

  const plansSectionRef = useRef<HTMLElement | null>(null);
  const summarySectionRef = useRef<HTMLElement | null>(null);
  const paymentSectionRef = useRef<HTMLElement | null>(null);
  const invoiceSectionRef = useRef<HTMLElement | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectDetailsQuery = api.project.getProjectDetails.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const billingOverviewQuery = api.billing.getBillingOverview.useQuery({
    projectId: projectId ?? null,
  });

  const checkoutMutation = api.billing.checkout.useMutation({
    onSuccess: async (result) => {
      if (result.status === "SUCCESS") {
        setCheckoutState("success");
        setCheckoutMessage("Payment successful. Invoice generated.");
        toast.success("Payment successful");
      } else {
        setCheckoutState("waiting");
        setCheckoutMessage(result.message);
        toast.error(result.message);
      }

      await billingOverviewQuery.refetch();
    },
    onError: (error) => {
      setCheckoutState("waiting");
      const message = error.message || "Verification failed. Please try again.";
      setCheckoutMessage(message);
      toast.error(message);
    },
  });

  const selectedPlan = useMemo<PlanOption>(() => {
    const fallbackPlan: PlanOption = {
      key: "pro",
      name: "Pro",
      priceInPaise: 499900,
      featured: true,
      highlights: ["Unlimited projects", "1,000 commit summaries", "Priority AI support"],
    };

    return plans.find((plan) => plan.key === selectedPlanKey) ?? fallbackPlan;
  }, [selectedPlanKey]);

  const selectedMethod = useMemo<PaymentMethodOption>(() => {
    const fallbackMethod: PaymentMethodOption = {
      id: "upi_primary",
      type: "upi",
      brand: "UPI",
      label: "Scan & Pay",
      meta: "dionysus.payments@upi",
      simulateFailure: false,
    };

    return paymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? fallbackMethod;
  }, [selectedPaymentMethodId]);

  const isUpiSelected = selectedMethod.type === "upi";

  useEffect(() => {
    if (!isUpiSelected) {
      setQrCountdown(60);
      return;
    }

    setQrCountdown(60);
    setQrNonce(`${Date.now()}`);

    const timer = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          setQrNonce(`${Date.now()}`);
          return 60;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isUpiSelected, selectedPlanKey]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const elements = [
      plansSectionRef.current,
      summarySectionRef.current,
      paymentSectionRef.current,
      invoiceSectionRef.current,
    ].filter(Boolean) as HTMLElement[];

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const sectionStep = (visible.target as HTMLElement).dataset.step as StepKey | undefined;
        if (sectionStep) {
          setActiveStep(sectionStep);
        }
      },
      {
        threshold: [0.25, 0.45, 0.7],
        rootMargin: "-10% 0px -55% 0px",
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [billingOverviewQuery.data?.hasSuccessfulPayment]);

  const setTemporaryHighlights = (target: "plans" | "summary") => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    setHighlightPlans(target === "plans");
    setHighlightSummary(target === "summary");

    highlightTimerRef.current = setTimeout(() => {
      setHighlightPlans(false);
      setHighlightSummary(false);
    }, 1200);
  };

  const usageCounts = projectDetailsQuery.data?._count;
  const commitsUsed = usageCounts?.Commit ?? 0;
  const questionsUsed = usageCounts?.Question ?? 0;
  const collaboratorsUsed = usageCounts?.User ?? 1;

  const usageCards = [
    {
      label: "Commit Summaries",
      value: commitsUsed,
      limit: 1000,
      tone: "from-cyan-500/20 to-blue-500/10",
    },
    {
      label: "AI Q&A Messages",
      value: questionsUsed,
      limit: 500,
      tone: "from-emerald-500/20 to-teal-500/10",
    },
    {
      label: "Team Members",
      value: collaboratorsUsed,
      limit: 10,
      tone: "from-orange-500/20 to-amber-500/10",
    },
  ] as const;

  const invoices = billingOverviewQuery.data?.invoices ?? [];
  const totalSpendInPaise = billingOverviewQuery.data?.totalSpendInPaise ?? 0;
  const hasSuccessfulPayment = billingOverviewQuery.data?.hasSuccessfulPayment ?? false;
  const isTrial = !hasSuccessfulPayment;

  const upiId = "dionysus.payments@upi";
  const upiAmount = selectedPlan.priceInPaise ? (selectedPlan.priceInPaise / 100).toFixed(2) : "0.00";
  const upiPaymentLink = `upi://pay?pa=${upiId}&pn=Dionysus%20AI%20Git&am=${upiAmount}&cu=INR&tr=${encodeURIComponent(`DIO-${qrNonce}`)}&tn=${encodeURIComponent(selectedPlan.name + " Plan")}`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiPaymentLink)}`;

  const scrollToPlanSelection = () => {
    plansSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setTemporaryHighlights("plans");
  };

  const handlePlanSelection = (planKey: "starter" | "pro") => {
    setSelectedPlanKey(planKey);
    setCheckoutState("waiting");
    setCheckoutMessage("Waiting for payment confirmation.");

    summarySectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setTemporaryHighlights("summary");
  };

  const handlePaymentMethodSelection = (methodId: string) => {
    setSelectedPaymentMethodId(methodId);
    setCheckoutState("waiting");
    setCheckoutMessage("Waiting for payment confirmation.");
  };

  const handleCheckout = async () => {
    setCheckoutState("verifying");
    setCheckoutMessage("Verifying payment, please wait...");

    await checkoutMutation.mutateAsync({
      projectId: projectId ?? null,
      planKey: selectedPlanKey,
      paymentMethodId: selectedMethod.id,
      simulateFailure: selectedMethod.simulateFailure,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
            <p className="text-sm text-muted-foreground">
              Billing usage is visible first for fast consumption tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Current Step: {stepLabel[activeStep]}</Badge>
            <Button variant="outline" className="hover:shadow-sm" onClick={scrollToPlanSelection}>
              Manage Subscription
            </Button>
          </div>
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
              <p className="mt-1 text-lg font-semibold">Pro Workspace</p>
              {isTrial && (
                <Badge variant="outline" className="mt-2 border-emerald-300 bg-emerald-50 text-emerald-700">
                  New Account — Free Trial
                </Badge>
              )}
            </div>
            <div className="rounded-xl border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Spend</p>
              <p className="mt-1 text-lg font-semibold">{formatInr(totalSpendInPaise)}</p>
            </div>
            <div className="rounded-xl border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Project</p>
              <p className="mt-1 truncate text-lg font-semibold">{project?.name ?? "Workspace"}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {usageCards.map((item) => {
            const percent = clampPercent((item.value / item.limit) * 100);
            return (
              <Card
                key={item.label}
                className={cn(
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  "bg-gradient-to-br",
                  item.tone,
                )}
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.label}</p>
                    <Badge variant="outline">{percent}%</Badge>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight">
                      {item.value}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / {item.limit}
                      </span>
                    </p>
                    <Progress value={percent} className="mt-3 h-2.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        ref={plansSectionRef}
        data-step="plan"
        className={cn(
          "space-y-3 rounded-xl border border-transparent p-1 transition-colors duration-300",
          highlightPlans && "border-primary/40 bg-primary/5",
        )}
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Plan Selection</h2>
          <p className="text-sm text-muted-foreground">Select plan to continue checkout flow.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSelectable = plan.key === "starter" || plan.key === "pro";
            const isSelected = isSelectable && plan.key === selectedPlanKey;

            return (
              <Card
                key={plan.name}
                className={cn(
                  "relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  isSelected && "border-primary bg-primary/5 shadow-sm",
                )}
              >
                {plan.featured && (
                  <Badge className="absolute right-4 top-4" variant="default">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {plan.featured ? <Zap className="size-4 text-primary" /> : <Sparkles className="size-4" />}
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-xl font-semibold text-foreground">
                    {plan.priceInPaise ? formatInr(plan.priceInPaise) + " / mo" : "Custom"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.highlights.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="size-4 text-emerald-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  {isSelectable ? (
                    <Button
                      className="w-full"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => handlePlanSelection(plan.key as "starter" | "pro")}
                    >
                      {isSelected ? "Selected" : "Select Plan"}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline">
                      Contact Sales
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        ref={summarySectionRef}
        data-step="summary"
        className={cn(
          "rounded-xl border border-transparent p-1 transition-colors duration-300",
          highlightSummary && "border-primary/40 bg-primary/5",
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-4" />
              Checkout Summary
            </CardTitle>
            <CardDescription>Updates instantly with selected plan details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
              <p className="mt-1 text-lg font-semibold">{selectedPlan.name}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
              <p className="mt-1 text-lg font-semibold">
                {selectedPlan.priceInPaise ? formatInr(selectedPlan.priceInPaise) : "Custom"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Method</p>
              <p className="mt-1 text-lg font-semibold">{selectedMethod.brand}</p>
              <p className="text-xs text-muted-foreground">{selectedMethod.meta}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section ref={paymentSectionRef} data-step="payment" className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Payment</h2>
          <p className="text-sm text-muted-foreground">
            Choose method, pay, and verify. UPI QR appears only for UPI method.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="size-4" />
                Method Selection
              </CardTitle>
              <CardDescription>Select payment method for this transaction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentMethods.map((method) => {
                const isSelected = selectedPaymentMethodId === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handlePaymentMethodSelection(method.id)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors hover:bg-muted/35",
                      isSelected ? "border-primary bg-primary/5" : "bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{method.brand}</p>
                        <p className="text-xs text-muted-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.meta}</p>
                      </div>
                      <Badge variant={isSelected ? "default" : "outline"}>
                        {isSelected ? "Selected" : "Choose"}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {isUpiSelected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="size-4" />
                    UPI QR Checkout
                  </CardTitle>
                  <Badge variant="outline">Refresh in {qrCountdown}s</Badge>
                </div>
                <CardDescription>Scan to pay with any UPI app</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm">
                  <Image
                    src={upiQrCodeUrl}
                    alt="UPI QR code for payment"
                    width={220}
                    height={220}
                    className="size-[220px] rounded-lg"
                  />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">UPI ID</p>
                  <p className="mt-1 font-medium">{upiId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Amount: {formatInr(selectedPlan.priceInPaise ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase tracking-wide">Status</p>
                  <p className="mt-1">
                    {checkoutState === "waiting" && "waiting"}
                    {checkoutState === "verifying" && "verifying"}
                    {checkoutState === "success" && "success"}
                  </p>
                  <p className="mt-1">{checkoutMessage}</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    void handleCheckout();
                  }}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Verify Payment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Card Checkout</CardTitle>
                <CardDescription>UPI QR is hidden because card method is selected.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Payable Amount</p>
                  <p className="mt-1 text-lg font-semibold">
                    {selectedPlan.priceInPaise ? formatInr(selectedPlan.priceInPaise) : "Custom"}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase tracking-wide">Status</p>
                  <p className="mt-1">
                    {checkoutState === "waiting" && "waiting"}
                    {checkoutState === "verifying" && "verifying"}
                    {checkoutState === "success" && "success"}
                  </p>
                  <p className="mt-1">{checkoutMessage}</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    void handleCheckout();
                  }}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Verify Payment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {hasSuccessfulPayment && (
        <section ref={invoiceSectionRef} data-step="invoice" className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Invoice</h2>
            <p className="text-sm text-muted-foreground">Visible only after successful payment.</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ReceiptText className="size-4" />
                    Invoices
                  </CardTitle>
                  <CardDescription>Fetched dynamically from Prisma.</CardDescription>
                </div>
                <Button variant="outline" size="sm" disabled={invoices.length === 0}>
                  <Download className="size-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {billingOverviewQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading invoices...</p>
              )}

              {!billingOverviewQuery.isLoading && invoices.length === 0 && (
                <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center">
                  <p className="text-sm font-medium">No invoices yet</p>
                </div>
              )}

              {!billingOverviewQuery.isLoading && invoices.length > 0 && (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.payment.planName}</TableCell>
                          <TableCell>
                            {new Date(invoice.issuedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{invoice.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatInr(invoice.amountInPaise)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};

export default BillingPage;
