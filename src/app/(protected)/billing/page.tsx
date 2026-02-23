"use client";

import { useMemo, useState } from "react";
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
import { toast } from "sonner";

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

interface PlanOption {
  key: "starter" | "pro" | "enterprise";
  name: string;
  priceInPaise: number | null;
  highlights: string[];
  featured?: boolean;
}

interface PaymentMethodOption {
  id: string;
  brand: string;
  label: string;
  meta: string;
  simulateFailure: boolean;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "upi_primary",
    brand: "UPI",
    label: "UPI AutoPay",
    meta: "demo-success@upi",
    simulateFailure: false,
  },
  {
    id: "card_test_fail",
    brand: "Test Card",
    label: "Failure simulation",
    meta: "xxxx xxxx xxxx 0002",
    simulateFailure: true,
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

const BillingPage = () => {
  const { projectId, project } = useProject();
  const [selectedPlanKey, setSelectedPlanKey] = useState<"starter" | "pro">("pro");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>(
    paymentMethods[0]?.id ?? "",
  );
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "success" | "failure">(
    "idle",
  );
  const [checkoutMessage, setCheckoutMessage] = useState<string>("");

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
        setCheckoutMessage("Payment successful. Invoice has been generated.");
        toast.success("Payment successful");
      } else {
        setCheckoutState("failure");
        setCheckoutMessage(result.message);
        toast.error(result.message);
      }

      await billingOverviewQuery.refetch();
    },
    onError: (error) => {
      const message = error.message || "Payment failed. Please try again.";
      setCheckoutState("failure");
      setCheckoutMessage(message);
      toast.error(message);
    },
  });

  const usageCounts = projectDetailsQuery.data?._count;
  const commitsUsed = usageCounts?.Commit ?? 0;
  const questionsUsed = usageCounts?.Question ?? 0;
  const collaboratorsUsed = usageCounts?.User ?? 1;

  const commitLimit = 1000;
  const questionLimit = 500;
  const collaboratorLimit = 10;

  const usageCards = [
    {
      label: "Commit Summaries",
      value: commitsUsed,
      limit: commitLimit,
      tone: "from-cyan-500/20 to-blue-500/10",
    },
    {
      label: "AI Q&A Messages",
      value: questionsUsed,
      limit: questionLimit,
      tone: "from-emerald-500/20 to-teal-500/10",
    },
    {
      label: "Team Members",
      value: collaboratorsUsed,
      limit: collaboratorLimit,
      tone: "from-orange-500/20 to-amber-500/10",
    },
  ] as const;

  const invoices = billingOverviewQuery.data?.invoices ?? [];
  const totalSpendInPaise = billingOverviewQuery.data?.totalSpendInPaise ?? 0;
  const hasSuccessfulPayment = billingOverviewQuery.data?.hasSuccessfulPayment ?? false;
  const isTrial = !hasSuccessfulPayment;

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey),
    [selectedPlanKey],
  );

  const handleCheckout = async () => {
    const method = paymentMethods.find((item) => item.id === selectedPaymentMethodId);
    if (!method) {
      toast.error("Please select a payment method");
      return;
    }

    setCheckoutState("loading");
    setCheckoutMessage("Processing payment...");

    await checkoutMutation.mutateAsync({
      projectId: projectId ?? null,
      planKey: selectedPlanKey,
      paymentMethodId: method.id,
      simulateFailure: method.simulateFailure,
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_60%)]" />
        <CardHeader className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Badge className="w-fit" variant="secondary">
                Active Plan
              </Badge>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl tracking-tight">Pro Workspace</CardTitle>
                {isTrial && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    New Account — Free Trial
                  </Badge>
                )}
              </div>
              <CardDescription className="max-w-2xl text-sm leading-relaxed">
                Scale commit intelligence and repository QA with higher limits, priority AI, and INR
                billing support.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="hover:shadow-sm">
                Manage Subscription
              </Button>
              <Button className="group bg-primary text-primary-foreground">
                <Sparkles className="size-4 transition-transform group-hover:rotate-12" />
                Upgrade
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing Cycle</p>
            <p className="mt-2 text-xl font-semibold">Feb 2026</p>
            <p className="mt-1 text-xs text-muted-foreground">Renews on Mar 1, 2026</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Spend</p>
            <p className="mt-2 text-xl font-semibold">{formatInr(totalSpendInPaise)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Includes successful INR payments</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Project</p>
            <p className="mt-2 truncate text-xl font-semibold">{project?.name ?? "Workspace"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {projectId
                ? "Billing context filtered to selected project"
                : "No project selected, showing workspace-level billing"}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Usage</h2>
          <p className="text-sm text-muted-foreground">
            Track limits and capacity across billing resources.
          </p>
        </div>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-4" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Select a payment method and checkout in INR.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethods.map((method) => {
              const isSelected = selectedPaymentMethodId === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedPaymentMethodId(method.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    "hover:bg-muted/35",
                    isSelected ? "border-primary bg-primary/5" : "bg-muted/20",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{method.brand}</p>
                      <p className="text-xs text-muted-foreground">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.meta}</p>
                    </div>
                    {method.simulateFailure ? (
                      <Badge variant="outline">Failure test</Badge>
                    ) : (
                      <Badge variant="default">Recommended</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-4" />
              Checkout
            </CardTitle>
            <CardDescription>Simple and lightweight payment simulation for INR billing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Select Plan</p>
              <div className="grid gap-2">
                {plans
                  .filter((plan) => plan.key !== "enterprise")
                  .map((plan) => {
                    const isActive = selectedPlanKey === plan.key;
                    return (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => setSelectedPlanKey(plan.key as "starter" | "pro")}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
                          isActive ? "border-primary bg-primary/5" : "bg-muted/20 hover:bg-muted/30",
                        )}
                      >
                        <span className="font-medium">{plan.name}</span>
                        <span>{plan.priceInPaise ? formatInr(plan.priceInPaise) : "Custom"}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Checkout Amount</p>
              <p className="mt-1 text-2xl font-semibold">
                {selectedPlan?.priceInPaise ? formatInr(selectedPlan.priceInPaise) : "Custom"}
              </p>
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
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  Checkout in INR
                </>
              )}
            </Button>

            {checkoutState !== "idle" && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  checkoutState === "success" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                  checkoutState === "failure" && "border-rose-300 bg-rose-50 text-rose-700",
                  checkoutState === "loading" && "border-blue-300 bg-blue-50 text-blue-700",
                )}
              >
                {checkoutMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ReceiptText className="size-4" />
                Invoices
              </CardTitle>
              <CardDescription>Fetched dynamically from Prisma after successful payment.</CardDescription>
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
              <p className="mt-1 text-xs text-muted-foreground">
                Complete a successful payment to generate your first invoice.
              </p>
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

      <section className="space-y-3 pb-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Upgrade Options</h2>
          <p className="text-sm text-muted-foreground">Choose the plan that matches your team size.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                plan.featured && "border-primary shadow-sm",
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
                <Button className="w-full" variant={plan.featured ? "default" : "outline"}>
                  {plan.key === "enterprise"
                    ? "Contact Sales"
                    : plan.featured
                      ? "Keep Pro"
                      : "Choose Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default BillingPage;
