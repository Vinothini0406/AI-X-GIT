"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useProject from "@/hooks/use-project";
import { billingPlans, type BillingPlanKey } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const formatInr = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);

const planOptions = Object.values(billingPlans);

const BillingPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectId, project } = useProject();
  const processedSessionRef = useRef<string | null>(null);

  const [selectedPlanKey, setSelectedPlanKey] = useLocalStorage<BillingPlanKey>(
    "dionysus-billing-selected-plan",
    "premium",
  );
  const [checkoutNotice, setCheckoutNotice] = useState<{
    tone: "success" | "warning" | "info";
    title: string;
    description: string;
  } | null>(null);

  const billingOverviewQuery = api.billing.getBillingOverview.useQuery({
    projectId: projectId ?? null,
  });

  const createCheckoutSession = api.billing.createCheckoutSession.useMutation({
    onMutate: () => {
      setCheckoutNotice({
        tone: "info",
        title: "Starting checkout",
        description: "Creating a secure Stripe Checkout session.",
      });
    },
    onSuccess: (result) => {
      setCheckoutNotice({
        tone: "info",
        title: "Redirecting to Stripe",
        description:
          "You will complete payment on Stripe's hosted checkout page.",
      });
      window.location.assign(result.checkoutUrl);
    },
    onError: (error) => {
      setCheckoutNotice({
        tone: "warning",
        title: "Checkout could not start",
        description: error.message || "Unable to start Stripe Checkout.",
      });
      toast.error(error.message || "Unable to start Stripe Checkout");
    },
  });

  const verifyCheckoutSession = api.billing.verifyCheckoutSession.useMutation({
    onSuccess: async (result) => {
      if (result.status === "SUCCESS") {
        setCheckoutNotice({
          tone: "success",
          title: "Payment confirmed",
          description: "Your invoice is ready in billing history.",
        });
        toast.success("Payment confirmed");
      } else {
        setCheckoutNotice({
          tone: "info",
          title: "Payment pending",
          description: result.message,
        });
      }

      await billingOverviewQuery.refetch();
      router.replace("/billing", { scroll: false });
    },
    onError: (error) => {
      setCheckoutNotice({
        tone: "warning",
        title: "Verification failed",
        description:
          error.message || "Stripe has not confirmed this payment yet.",
      });
      toast.error(error.message || "Unable to verify Stripe payment");
    },
  });

  const checkoutStatus = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const cancelledPlan = searchParams.get("plan");

  useEffect(() => {
    if (cancelledPlan === "basic" || cancelledPlan === "premium") {
      setSelectedPlanKey(cancelledPlan);
    }
  }, [cancelledPlan, setSelectedPlanKey]);

  useEffect(() => {
    if (checkoutStatus === "cancelled") {
      setCheckoutNotice({
        tone: "warning",
        title: "Checkout cancelled",
        description:
          "No payment was recorded. You can restart checkout when ready.",
      });
      router.replace("/billing", { scroll: false });
      return;
    }

    if (checkoutStatus !== "success" || !checkoutSessionId) {
      return;
    }

    if (processedSessionRef.current === checkoutSessionId) {
      return;
    }

    processedSessionRef.current = checkoutSessionId;
    setCheckoutNotice({
      tone: "info",
      title: "Confirming payment",
      description:
        "Checking the Stripe session and refreshing your invoice history.",
    });

    verifyCheckoutSession.mutate({ sessionId: checkoutSessionId });
  }, [checkoutSessionId, checkoutStatus, router, verifyCheckoutSession]);

  const selectedPlan = billingPlans[selectedPlanKey];
  const invoices = billingOverviewQuery.data?.invoices ?? [];
  const totalSpendInPaise = billingOverviewQuery.data?.totalSpendInPaise ?? 0;
  const latestInvoice = invoices[0];
  const currentPlan = latestInvoice?.payment.planName ?? "No paid plan yet";
  const isCheckingOut = createCheckoutSession.isPending;
  const isVerifying = verifyCheckoutSession.isPending;

  const billingStats = useMemo(
    () => [
      {
        label: "Current plan",
        value: currentPlan,
        icon: WalletCards,
      },
      {
        label: "Total spend",
        value: formatInr(totalSpendInPaise),
        icon: ReceiptText,
      },
      {
        label: "Billing scope",
        value: project?.name ?? "Workspace",
        icon: FileText,
      },
    ],
    [currentPlan, project?.name, totalSpendInPaise],
  );

  const handleCheckout = async () => {
    await createCheckoutSession.mutateAsync({
      projectId: projectId ?? null,
      planKey: selectedPlanKey,
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-muted-foreground inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium">
            <CreditCard className="size-3.5" />
            Stripe billing
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Simple plans, secure checkout
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            Choose a plan, review the total, and complete payment through Stripe
            Checkout.
          </p>
        </div>

        <div className="bg-muted/25 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <LockKeyhole className="size-4" />
          <span className="font-medium">Hosted payment flow</span>
        </div>
      </section>

      {checkoutNotice && (
        <section
          className={cn(
            "rounded-lg border p-4",
            checkoutNotice.tone === "success" && "bg-muted/30",
            checkoutNotice.tone === "warning" && "bg-muted/20",
            checkoutNotice.tone === "info" && "bg-background",
          )}
        >
          <div className="flex items-start gap-3">
            {isVerifying ? (
              <Loader2 className="mt-0.5 size-4 animate-spin" />
            ) : (
              <ShieldCheck className="mt-0.5 size-4" />
            )}
            <div>
              <p className="text-sm font-semibold">{checkoutNotice.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {checkoutNotice.description}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {billingStats.map((stat) => {
          const StatIcon = stat.icon;

          return (
            <div key={stat.label} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm font-medium">
                  {stat.label}
                </p>
                <StatIcon className="text-muted-foreground size-4" />
              </div>
              {billingOverviewQuery.isLoading ? (
                <Skeleton className="mt-3 h-7 w-32" />
              ) : (
                <p className="mt-3 truncate text-xl font-semibold tracking-tight">
                  {stat.value}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          {planOptions.map((plan) => {
            const isSelected = selectedPlanKey === plan.key;
            const isPremium = plan.key === "premium";

            return (
              <Card
                key={plan.key}
                className={cn(
                  "rounded-lg shadow-none transition-colors",
                  isSelected && "border-foreground",
                  isPremium && isSelected && "bg-foreground text-background",
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      variant={
                        isPremium && isSelected ? "secondary" : "outline"
                      }
                      className="rounded-sm"
                    >
                      {plan.eyebrow}
                    </Badge>
                    {isSelected && (
                      <Badge
                        variant={isPremium ? "secondary" : "default"}
                        className="rounded-sm"
                      >
                        Selected
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2 pt-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {isPremium ? (
                        <Sparkles className="size-4" />
                      ) : (
                        <WalletCards className="size-4" />
                      )}
                      {plan.name}
                    </CardTitle>
                    <CardDescription
                      className={cn(
                        isPremium && isSelected && "text-background/70",
                      )}
                    >
                      {plan.description}
                    </CardDescription>
                  </div>
                  <div className="pt-2">
                    <p className="text-4xl font-semibold tracking-tight">
                      {formatInr(plan.displayAmountInPaise)}
                    </p>
                    <p
                      className={cn(
                        "text-muted-foreground mt-1 text-xs",
                        isPremium && isSelected && "text-background/65",
                      )}
                    >
                      One-time Stripe checkout
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {plan.checkoutNote && (
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs leading-5",
                        isPremium && isSelected
                          ? "border-background/20 text-background/75"
                          : "bg-muted/25 text-muted-foreground",
                      )}
                    >
                      Checkout amount: {formatInr(plan.amountInPaise)}.{" "}
                      {plan.checkoutNote}
                    </div>
                  )}
                  <div className="space-y-3">
                    {plan.benefits.map((benefit) => (
                      <div
                        key={benefit}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="mt-0.5 size-4 shrink-0" />
                        <span
                          className={cn(
                            "text-muted-foreground",
                            isPremium && isSelected && "text-background/75",
                          )}
                        >
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full rounded-md"
                    variant={
                      isSelected
                        ? isPremium
                          ? "secondary"
                          : "default"
                        : "outline"
                    }
                    onClick={() => setSelectedPlanKey(plan.key)}
                  >
                    {isSelected ? "Plan selected" : "Select plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit rounded-lg shadow-none xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-4" />
              Checkout summary
            </CardTitle>
            <CardDescription>
              Review before continuing to Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-right font-medium">
                  {selectedPlan.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <span className="text-muted-foreground">Project</span>
                <span className="truncate text-right font-medium">
                  {project?.name ?? "Workspace"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Amount due</span>
                <span className="text-2xl font-semibold tracking-tight">
                  {formatInr(selectedPlan.amountInPaise)}
                </span>
              </div>
            </div>

            {selectedPlan.displayAmountInPaise !==
              selectedPlan.amountInPaise && (
              <div className="bg-muted/25 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Plan price</span>
                  <span className="font-medium">
                    {formatInr(selectedPlan.displayAmountInPaise)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 text-xs leading-5">
                  {selectedPlan.checkoutNote}
                </p>
              </div>
            )}

            <div className="bg-muted/25 text-muted-foreground rounded-md border p-3 text-sm">
              <div className="text-foreground flex items-center gap-2 font-medium">
                <LockKeyhole className="size-4" />
                Payment handled by Stripe
              </div>
              <p className="mt-2 leading-5">
                Card details are collected on Stripe-hosted checkout. The app
                records the successful payment after Stripe confirms the
                session.
              </p>
            </div>

            <Button
              className="h-11 w-full rounded-md"
              onClick={() => {
                void handleCheckout();
              }}
              disabled={isCheckingOut || isVerifying}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting checkout
                </>
              ) : (
                <>
                  Continue to Stripe
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden rounded-lg py-0 shadow-none">
        <CardHeader className="border-b px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ReceiptText className="size-4" />
                Billing history
              </CardTitle>
              <CardDescription>
                Successful Stripe payments and generated invoices.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="rounded-md" disabled>
              <ExternalLink className="size-4" />
              Customer portal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {billingOverviewQuery.isLoading && (
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!billingOverviewQuery.isLoading && invoices.length === 0 && (
            <div className="px-4 py-8 text-center sm:px-5">
              <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-md border">
                <ReceiptText className="size-4" />
              </div>
              <p className="text-sm font-medium">No paid invoices yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Completed Stripe payments will appear here.
              </p>
            </div>
          )}

          {!billingOverviewQuery.isLoading && invoices.length > 0 && (
            <div className="overflow-x-auto">
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
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{invoice.payment.planName}</TableCell>
                      <TableCell>
                        {new Date(invoice.issuedAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-sm">
                          {invoice.status}
                        </Badge>
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
    </div>
  );
};

export default BillingPage;
