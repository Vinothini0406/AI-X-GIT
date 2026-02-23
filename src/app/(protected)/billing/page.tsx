"use client";

import {
  Check,
  CreditCard,
  Download,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

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

interface InvoiceItem {
  id: string;
  date: string;
  amount: string;
  status: "Paid" | "Pending";
}

interface PlanOption {
  name: string;
  price: string;
  highlights: string[];
  featured?: boolean;
}

const paymentMethods = [
  {
    id: "pm_visa",
    brand: "Visa",
    label: "Corporate card",
    last4: "4242",
    expires: "02/29",
    isDefault: true,
  },
  {
    id: "pm_mastercard",
    brand: "Mastercard",
    label: "Backup card",
    last4: "1712",
    expires: "08/28",
    isDefault: false,
  },
];

const invoices: InvoiceItem[] = [
  { id: "INV-1042", date: "Feb 01, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-1031", date: "Jan 01, 2026", amount: "$49.00", status: "Paid" },
  { id: "INV-1024", date: "Dec 01, 2025", amount: "$49.00", status: "Paid" },
  { id: "INV-1018", date: "Nov 01, 2025", amount: "$49.00", status: "Paid" },
];

const plans: PlanOption[] = [
  {
    name: "Starter",
    price: "$19 / mo",
    highlights: ["5 projects", "150 commit summaries", "Basic AI support"],
  },
  {
    name: "Pro",
    price: "$49 / mo",
    featured: true,
    highlights: ["Unlimited projects", "1,000 commit summaries", "Priority AI support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    highlights: ["SAML & SOC2 workflows", "Dedicated model tuning", "SLA and support"],
  },
];

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const BillingPage = () => {
  const { projectId, project } = useProject();
  const projectDetailsQuery = api.project.getProjectDetails.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

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
              <CardTitle className="text-2xl tracking-tight">Pro Workspace</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-relaxed">
                Scale commit intelligence and repository QA with priority processing and
                higher usage limits.
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
            <p className="mt-2 text-xl font-semibold">$49.00</p>
            <p className="mt-1 text-xs text-muted-foreground">Includes AI usage credits</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Project</p>
            <p className="mt-2 truncate text-xl font-semibold">{project?.name ?? "No project"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {projectId ? "Usage below reflects current project context" : "Select a project in the sidebar"}
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
            <CardDescription>Add and manage cards for automatic billing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4 transition-colors hover:bg-muted/35"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                    <CreditCard className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {method.brand} •••• {method.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {method.label} · Expires {method.expires}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {method.isDefault && <Badge>Default</Badge>}
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full sm:w-auto">
              Add Payment Method
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-4" />
              Billing Security
            </CardTitle>
            <CardDescription>Enterprise-grade controls for financial operations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="font-medium">Secure processing</p>
              <p className="mt-1 text-muted-foreground">PCI-compliant card storage and tokenized payments.</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="font-medium">Invoice compliance</p>
              <p className="mt-1 text-muted-foreground">
                Download tax-ready invoices and monthly statements instantly.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="font-medium">Usage alerts</p>
              <p className="mt-1 text-muted-foreground">
                Get notifications when any usage metric reaches 80%.
              </p>
            </div>
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
              <CardDescription>View billing history and download receipts.</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "Paid" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{invoice.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                  {plan.price}
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
                  {plan.featured ? "Keep Pro" : "Choose Plan"}
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
