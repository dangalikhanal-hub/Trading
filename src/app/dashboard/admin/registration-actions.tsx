"use client";

import { useActionState } from "react";
import { reviewRegistration, type ReviewState } from "./actions";

const initialState: ReviewState = {};

export default function RegistrationActions({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(reviewRegistration, initialState);

  return (
    <form action={formAction} className="tv-admin-actions">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        name="intent"
        value="approve"
        disabled={pending}
        className="tv-button tv-admin-approve"
      >
        Approve
      </button>
      <button
        type="submit"
        name="intent"
        value="reject"
        disabled={pending}
        className="tv-button tv-admin-reject"
      >
        Reject
      </button>
      {state.error && (
        <span className="tv-admin-message tv-admin-message-error" role="alert">
          {state.error}
        </span>
      )}
      {state.success && (
        <span className="tv-admin-message tv-admin-message-success" role="status">
          {state.success}
        </span>
      )}
    </form>
  );
}
