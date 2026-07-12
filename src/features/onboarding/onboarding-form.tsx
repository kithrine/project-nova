"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { OnboardingFormState } from "@/features/onboarding/actions";

/**
 * Applicant onboarding form (Story 2.2). Mobile-first single column,
 * labels above inputs, programmatic error association
 * (docs/ux/accessibility.md), respectful plain language.
 */

const inputClasses = "rounded-md border border-base-300 px-3 py-2 text-sm";

function Field({
  label,
  name,
  error,
  optional,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}{" "}
        {optional ? <span className="font-normal text-base-content/60">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OnboardingForm({
  action,
  initialState = { status: "idle" },
}: {
  action: (prev: OnboardingFormState, formData: FormData) => Promise<OnboardingFormState>;
  initialState?: OnboardingFormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);
  const invalid = (name: string) => (errors[name] ? true : undefined);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4" noValidate>
      {state.formError ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm">
          {state.formError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Legal first name" name="legalFirstName" error={errors.legalFirstName}>
          <input
            id="legalFirstName"
            name="legalFirstName"
            type="text"
            autoComplete="given-name"
            required
            aria-invalid={invalid("legalFirstName")}
            aria-describedby={describedBy("legalFirstName")}
            className={inputClasses}
          />
        </Field>
        <Field label="Legal last name" name="legalLastName" error={errors.legalLastName}>
          <input
            id="legalLastName"
            name="legalLastName"
            type="text"
            autoComplete="family-name"
            required
            aria-invalid={invalid("legalLastName")}
            aria-describedby={describedBy("legalLastName")}
            className={inputClasses}
          />
        </Field>
      </div>

      <Field label="Date of birth" name="dateOfBirth" error={errors.dateOfBirth}>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          required
          aria-invalid={invalid("dateOfBirth")}
          aria-describedby={describedBy("dateOfBirth")}
          className={inputClasses}
        />
      </Field>

      <Field label="Phone number" name="phone" error={errors.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          aria-invalid={invalid("phone")}
          aria-describedby={describedBy("phone")}
          className={inputClasses}
        />
      </Field>

      <Field
        label="Mailing address"
        name="mailingAddressLine1"
        error={errors.mailingAddressLine1}
      >
        <input
          id="mailingAddressLine1"
          name="mailingAddressLine1"
          type="text"
          autoComplete="address-line1"
          required
          aria-invalid={invalid("mailingAddressLine1")}
          aria-describedby={describedBy("mailingAddressLine1")}
          className={inputClasses}
        />
      </Field>

      <Field
        label="Apartment, suite, or unit"
        name="mailingAddressLine2"
        error={errors.mailingAddressLine2}
        optional
      >
        <input
          id="mailingAddressLine2"
          name="mailingAddressLine2"
          type="text"
          autoComplete="address-line2"
          aria-describedby={describedBy("mailingAddressLine2")}
          className={inputClasses}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="City" name="city" error={errors.city}>
          <input
            id="city"
            name="city"
            type="text"
            autoComplete="address-level2"
            required
            aria-invalid={invalid("city")}
            aria-describedby={describedBy("city")}
            className={inputClasses}
          />
        </Field>
        <Field label="State or region" name="region" error={errors.region}>
          <input
            id="region"
            name="region"
            type="text"
            autoComplete="address-level1"
            required
            aria-invalid={invalid("region")}
            aria-describedby={describedBy("region")}
            className={inputClasses}
          />
        </Field>
        <Field label="Postal code" name="postalCode" error={errors.postalCode}>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            required
            aria-invalid={invalid("postalCode")}
            aria-describedby={describedBy("postalCode")}
            className={inputClasses}
          />
        </Field>
      </div>

      <p className="max-w-prose text-sm text-base-content/70">
        We use this to keep your record accurate and to reach you about your application.
        Your information stays private.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and Continue"}
        </Button>
      </div>
    </form>
  );
}
