import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import RegistrationActions from "./registration-actions";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AdminRegistrationsPage() {
  await connection();
  const session = await auth();
  if (!session) redirect("/auth/login");
  const role = (session.user as typeof session.user & { role?: string }).role;
  if (role !== "ADMIN") redirect("/dashboard");

  const [pending, processed, approvedCount, rejectedCount] = await Promise.all([
    prisma.registrationRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.registrationRequest.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { reviewedBy: { select: { email: true } } },
    }),
    prisma.registrationRequest.count({ where: { status: "APPROVED" } }),
    prisma.registrationRequest.count({ where: { status: "REJECTED" } }),
  ]);

  return (
    <div className="tv-content tv-admin-content" id="admin">
      <div className="tv-page-heading tv-enter">
        <div>
          <div className="tv-eyebrow">
            <span className="tv-dot" /> ADMINISTRATION
          </div>
          <h1>
            Registration <span>requests.</span>
          </h1>
          <p>Verify new users before their accounts are created.</p>
        </div>
        <Link className="tv-button tv-quiet" href="/dashboard">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
      </div>

      <div className="tv-notice tv-enter">
        <ShieldCheck size={17} />
        <span>
          <strong>Super admin access.</strong> Approving a request creates the
          user account and its demo wallets. Only you can verify new users.
        </span>
        <span className="tv-notice-tag">ADMIN</span>
      </div>

      <section className="tv-admin-stats tv-enter" aria-label="Registration overview">
        <article className="tv-card tv-admin-stat">
          <span className="tv-admin-stat-icon tv-admin-stat-pending">
            <Clock3 size={17} />
          </span>
          <div>
            <small>Awaiting review</small>
            <strong>{pending.length}</strong>
          </div>
        </article>
        <article className="tv-card tv-admin-stat">
          <span className="tv-admin-stat-icon tv-admin-stat-approved">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <small>Approved</small>
            <strong>{approvedCount}</strong>
          </div>
        </article>
        <article className="tv-card tv-admin-stat">
          <span className="tv-admin-stat-icon tv-admin-stat-rejected">
            <XCircle size={17} />
          </span>
          <div>
            <small>Rejected</small>
            <strong>{rejectedCount}</strong>
          </div>
        </article>
      </section>

      <section className="tv-card tv-admin-panel tv-enter">
        <div className="tv-panel-heading">
          <h2>
            Pending approval <span className="tv-count">{String(pending.length).padStart(2, "0")}</span>
          </h2>
          <Clock3 size={17} className="tv-muted" />
        </div>

        {pending.length === 0 ? (
          <p className="tv-empty">No registration requests are waiting for review.</p>
        ) : (
          <ul className="tv-admin-list">
            {pending.map((request) => (
              <li className="tv-admin-row" key={request.id}>
                <span className="tv-admin-avatar" aria-hidden="true">
                  {initials(request.name)}
                </span>
                <div className="tv-admin-person">
                  <strong>{request.name}</strong>
                  <small>{request.email}</small>
                </div>
                <span className="tv-admin-date">
                  Requested {dateFormatter.format(request.createdAt)}
                </span>
                <RegistrationActions id={request.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tv-card tv-admin-panel tv-enter">
        <div className="tv-panel-heading">
          <h2>Recent decisions</h2>
          <ShieldCheck size={17} className="tv-muted" />
        </div>

        {processed.length === 0 ? (
          <p className="tv-empty">No requests have been reviewed yet.</p>
        ) : (
          <ul className="tv-admin-list">
            {processed.map((request) => (
              <li className="tv-admin-row tv-admin-row-processed" key={request.id}>
                <span className="tv-admin-avatar" aria-hidden="true">
                  {initials(request.name)}
                </span>
                <div className="tv-admin-person">
                  <strong>{request.name}</strong>
                  <small>{request.email}</small>
                </div>
                <span className="tv-admin-date">
                  {request.reviewedAt ? dateFormatter.format(request.reviewedAt) : "—"}
                  {request.reviewedBy?.email ? ` · ${request.reviewedBy.email}` : ""}
                </span>
                <span
                  className={`tv-admin-status ${
                    request.status === "APPROVED" ? "tv-admin-status-approved" : "tv-admin-status-rejected"
                  }`}
                >
                  {request.status === "APPROVED" ? "Approved" : "Rejected"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="tv-footer">
        <span>
          TradeVision Pro <span>·</span> Registration control
        </span>
        <span>
          <ShieldCheck size={13} /> Super admin only
        </span>
      </footer>
    </div>
  );
}
