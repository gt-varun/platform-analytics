import React from 'react';
import {
  AlertOctagon,
  Check,
  CircleDot,
  ClipboardList,
  HelpCircle,
  KeyRound,
  Minus,
  Plug,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { PERMISSION_MATRIX, ROLES, ROLE_ORDER, RoleId, can } from '../config/roles';
import { PRICING_ASSUMPTIONS } from '../config/pricing';
import { ACTION_ITEMS, ENDPOINT_CONTRACTS, KNOWN_ISSUES, OPEN_QUESTIONS } from '../config/delivery';
import { ViewContext } from './context';
import { Badge, Callout, Card, Pagination, SectionHeading, StatTile, TableWrap, usePagination } from '../components/ui';
import { usePalette } from '../theme';

/* ------------------------------------------------------------------ */
/* §2 Access model                                                     */
/* ------------------------------------------------------------------ */

export const AccessView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const palette = usePalette();
  const permissionPager = usePagination(PERMISSION_MATRIX, 15);

  return (
  <div className="space-y-5 stagger">
    <Callout tone="info" icon={<ShieldCheck className="w-4 h-4 text-accent" />} title="Four layers, one permission model">
      Every view in this dashboard is gated by the matrix below — the sidebar, the tables and the drill-downs all read
      the same <code className="text-ink-2">can(role, permission)</code> check. Switching &quot;Viewing as&quot; in
      the header re-renders the whole app through a different layer.
    </Callout>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {ROLE_ORDER.map((roleId) => {
        const role = ROLES[roleId];
        const active = ctx.role === roleId;
        return (
          <Card key={roleId} className={active ? 'ring-1 ring-accent/30' : ''}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.role(role.id) }} />
                <h3 className="text-sm font-bold text-ink">{role.label}</h3>
              </div>
              {active && <Badge tone="info">viewing</Badge>}
            </div>
            <p className="text-xs text-muted mb-3">{role.scopeNote}</p>
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.map((permission) => (
                <span
                  key={permission}
                  className="text-[10px] font-mono text-muted bg-sunken border border-line rounded px-1.5 py-0.5"
                >
                  {permission}
                </span>
              ))}
            </div>
          </Card>
        );
      })}
    </div>

    <Card>
      <SectionHeading
        title="RBAC permission matrix"
        subtitle="The matrix the requirements doc asked to be modelled explicitly. Two rows are deliberate exclusions."
        icon={<KeyRound className="w-5 h-5 text-accent" />}
      />
      <TableWrap>
        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
              <th className="pb-3 pr-3">Capability</th>
              {ROLE_ORDER.map((roleId) => (
                <th
                  key={roleId}
                  className={`pb-3 px-3 text-center ${ctx.role === roleId ? 'text-ink' : ''}`}
                >
                  {ROLES[roleId].shortLabel}
                </th>
              ))}
              <th className="pb-3 pl-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {permissionPager.pageItems.map((row) => (
              <tr key={row.permission} className="hover:bg-sunken">
                <td className="py-3 pr-3">
                  <div className="text-ink font-medium">{row.label}</div>
                  <div className="text-[10px] font-mono text-subtle">{row.permission}</div>
                </td>
                {ROLE_ORDER.map((roleId) => {
                  const allowed = can(roleId as RoleId, row.permission);
                  return (
                    <td
                      key={roleId}
                      className={`py-3 px-3 text-center ${ctx.role === roleId ? 'bg-sunken' : ''}`}
                    >
                      {allowed ? (
                        <Check className="w-4 h-4 text-positive inline" />
                      ) : (
                        <Minus className="w-4 h-4 text-line-strong inline" />
                      )}
                    </td>
                  );
                })}
                <td className="py-3 pl-3 text-muted">{row.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Pagination state={permissionPager} noun="permissions" />
    </Card>

    <Callout tone="warning" icon={<AlertOctagon className="w-4 h-4 text-caution" />} title="This is a UX contract, not a security boundary">
      There is no auth backend wired up yet, so the active layer comes from the header switcher and all gating happens
      in the browser. When the per-user endpoints ship they must enforce the same matrix server-side — in particular{' '}
      <code className="text-ink-2">/me/usage</code> must refuse to return anyone else&apos;s row, and the Admin
      layer must be served pre-aggregated rather than filtered client-side.
    </Callout>
  </div>
  );
};

/* ------------------------------------------------------------------ */
/* §5–§9 Delivery                                                      */
/* ------------------------------------------------------------------ */

const SEVERITY_TONE = { blocker: 'danger', high: 'warning', medium: 'neutral' } as const;
const STATUS_TONE = { open: 'danger', in_dashboard: 'success', fixed: 'success' } as const;
const STATUS_LABEL = { open: 'open', in_dashboard: 'fixed in dashboard', fixed: 'fixed' } as const;
const ACTION_TONE = { done: 'success', in_progress: 'info', blocked: 'danger', not_started: 'neutral' } as const;
const ACTION_LABEL = { done: 'done', in_progress: 'in progress', blocked: 'blocked', not_started: 'not started' } as const;

export const DeliveryView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const openIssues = KNOWN_ISSUES.filter((issue) => issue.status === 'open').length;
  const requiredEndpoints = ENDPOINT_CONTRACTS.filter((endpoint) => endpoint.status === 'required').length;

  const endpointPager = usePagination(ENDPOINT_CONTRACTS, 15);

  const assumptionPager = usePagination(PRICING_ASSUMPTIONS, 15);

  const actionPager = usePagination(ACTION_ITEMS, 15);

  return (
    <div className="space-y-5 stagger">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile
          label="Requirements addressed"
          value="Complete"
          hint="Access model, per-user usage, overage, tiers, billing, modules"
          tone="success"
        />
        <StatTile
          label="Known issues still open"
          value={String(openIssues)}
          hint={`${KNOWN_ISSUES.length - openIssues} resolved inside the dashboard`}
          tone={openIssues > 0 ? 'danger' : 'success'}
        />
        <StatTile
          label="Endpoints still needed"
          value={String(requiredEndpoints)}
          hint="Blocking live per-user data"
          tone={requiredEndpoints > 0 ? 'warning' : 'success'}
        />
        <StatTile
          label="Data source right now"
          value={ctx.userLayer.source === 'live' ? 'Live' : 'Aggregates + preview'}
          hint={
            ctx.userLayer.source === 'live'
              ? 'Per-user endpoint is serving real data'
              : 'Aggregates live; per-user split modelled'
          }
          tone={ctx.userLayer.source === 'live' ? 'success' : 'warning'}
        />
      </div>

      <Card>
        <SectionHeading
          title="Known issues"
          subtitle="Carried straight from the requirements doc, plus what the build found."
          icon={<Wrench className="w-5 h-5 text-caution" />}
        />
        <div className="space-y-3">
          {KNOWN_ISSUES.map((issue) => (
            <div key={issue.id} className="rounded-xl border border-line bg-sunken p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
                <h3 className="text-sm font-bold text-ink">{issue.title}</h3>
                <Badge tone={STATUS_TONE[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
              </div>
              <p className="text-xs text-muted">{issue.detail}</p>
              <p className="text-[11px] text-muted mt-2">Owner: {issue.owner}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Data contract"
          subtitle="What the backend serves today and what each remaining view needs. Shapes are typed in src/types/platform.ts; the full spec — parameters, schemas, acceptance criteria and build order — is in docs/backend-api-requirements.md."
          icon={<Plug className="w-5 h-5 text-accent" />}
        />
        <TableWrap>
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                <th className="pb-3 pr-3">Endpoint</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Purpose</th>
                <th className="pb-3 pl-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {endpointPager.pageItems.map((endpoint) => (
                <tr key={endpoint.path} className="hover:bg-sunken align-top">
                  <td className="py-3 pr-3">
                    <div className="font-mono text-ink">
                      <span className="text-muted">{endpoint.method}</span> {endpoint.path}
                    </div>
                    <div className="text-[10px] font-mono text-subtle mt-0.5">{endpoint.shape}</div>
                  </td>
                  <td className="py-3 px-3">
                    <Badge tone={endpoint.status === 'live' ? 'success' : 'warning'}>{endpoint.status}</Badge>
                  </td>
                  <td className="py-3 px-3 text-muted max-w-md">{endpoint.purpose}</td>
                  <td className="py-3 pl-3 text-muted">{endpoint.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination state={endpointPager} noun="endpoints" />
      </Card>

      <Card>
        <SectionHeading
          title="Pricing assumptions in force"
          subtitle="Every number in the dashboard is computed from these. Change one line in src/config/pricing.ts and the whole app re-prices."
          icon={<CircleDot className="w-5 h-5 text-positive" />}
        />
        <TableWrap>
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                <th className="pb-3 pr-3">Parameter</th>
                <th className="pb-3 px-3">Value in use</th>
                <th className="pb-3 px-3">Confidence</th>
                <th className="pb-3 pl-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {assumptionPager.pageItems.map((assumption) => (
                <tr key={assumption.id} className="hover:bg-sunken">
                  <td className="py-3 pr-3 text-ink font-medium">{assumption.label}</td>
                  <td className="py-3 px-3 text-ink-2">{assumption.value}</td>
                  <td className="py-3 px-3">
                    <Badge
                      tone={
                        assumption.status === 'confirmed'
                          ? 'success'
                          : assumption.status === 'proposed'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {assumption.status}
                    </Badge>
                  </td>
                  <td className="py-3 pl-3 text-muted">{assumption.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination state={assumptionPager} noun="assumptions" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionHeading
            title="Open questions for leadership"
            icon={<HelpCircle className="w-5 h-5 text-accent" />}
          />
          <div className="space-y-3">
            {OPEN_QUESTIONS.map((question) => (
              <div key={question.id} className="rounded-xl border border-line bg-sunken p-3.5">
                <p className="text-sm font-semibold text-ink">{question.question}</p>
                <p className="text-xs text-muted mt-1">{question.context}</p>
                <p className="text-[11px] text-muted mt-2">Owner: {question.owner}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading title="Action items" icon={<ClipboardList className="w-5 h-5 text-accent" />} />
          <TableWrap>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-muted font-semibold border-b border-line text-[11px] uppercase">
                  <th className="pb-3 pr-3">Owner</th>
                  <th className="pb-3 px-3">Action</th>
                  <th className="pb-3 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {actionPager.pageItems.map((item) => (
                  <tr key={`${item.owner}-${item.action}`} className="hover:bg-sunken align-top">
                    <td className="py-3 pr-3 text-ink-2 font-medium whitespace-nowrap">{item.owner}</td>
                    <td className="py-3 px-3 text-muted">{item.action}</td>
                    <td className="py-3 pl-3 text-right">
                      <Badge tone={ACTION_TONE[item.status]}>{ACTION_LABEL[item.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination state={actionPager} noun="action items" />
        </Card>
      </div>

      <Callout tone="neutral" title="Delivery plan">
        <ol className="list-decimal pl-4 space-y-1">
          <li>
            <span className="text-ink font-semibold">Prototype for review</span> — this build replaces the static
            PDF export as the review surface. Metric definitions and layout are visible and challengeable; a Sheets
            export of the same tables is still worth producing for line-by-line comments.
          </li>
          <li>
            <span className="text-ink font-semibold">Role-based views</span> — built, starting from the per-user
            layer, then Admin rollups, Billing and Management.
          </li>
          <li>
            <span className="text-ink font-semibold">Relabelled billing breakdown</span> — shipped as Billing
            Management with channel definitions.
          </li>
          <li>
            <span className="text-ink font-semibold">Host live for stakeholders</span> — deploys to Vercel from
            this repo.
          </li>
          <li>
            <span className="text-ink font-semibold">Enterprise tier</span> — present as a first-class tier; the
            per-module Enterprise breakdown stays scoped to v2.
          </li>
        </ol>
      </Callout>
    </div>
  );
};
