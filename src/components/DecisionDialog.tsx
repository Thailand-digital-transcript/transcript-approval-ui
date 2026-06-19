'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import type { Decision } from '@/types/batch';

/** Payload returned to the parent via `onSubmit`. */
export interface DecisionPayload {
  decision: Decision;
  /** Required when `decision === 'REJECT'`; omitted when `decision === 'APPROVE'`. */
  rejectionReason?: string;
}

export interface DecisionDialogProps {
  /** Called with the validated decision payload when the user submits. */
  onSubmit: (d: DecisionPayload) => void;
  /** Disables the submit button (e.g. while a POST /decision is in flight). */
  pending?: boolean;
  /** Optional title override. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

/**
 * Whole-batch approve/reject modal used by the batch detail page (B10).
 *
 * - Lets the user choose `APPROVE` or `REJECT` (radio).
 * - When `REJECT` is selected, a textarea for the rejection reason is shown.
 * - Validation is delegated to zod (`rejectionReason` is required iff
 *   `decision === 'REJECT'`), wired through `react-hook-form` and the
 *   shadcn `Form` field components.
 * - On a valid submit, calls `onSubmit` exactly once with either
 *   `{ decision: 'APPROVE' }` (no `rejectionReason` key) or
 *   `{ decision: 'REJECT', rejectionReason }`. The `APPROVE` payload
 *   deliberately omits `rejectionReason` so the parent does not have to
 *   guard against a stray empty-string reason.
 * - Open/close state is owned by the parent: this component renders a
 *   shadcn `Dialog` that is always open. Mount/unmount the component to
 *   show/hide it. (Same contract as `<AlertDialog>` in shadcn — the
 *   modal is "present" iff the JSX is mounted.)
 */
export function DecisionDialog({
  onSubmit,
  pending = false,
  title = 'Approve or reject batch',
  description = 'Approve the batch to advance it, or reject it with a reason to send it back.',
}: DecisionDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: 'APPROVE', rejectionReason: '' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  // Watch `decision` so we can conditionally render the reason textarea.
  // `useWatch` (a hook) is preferred over `form.watch()` because it
  // participates in React Compiler's memoization — `form.watch()` is
  // flagged `react-hooks/incompatible-library`.
  const decision = useWatch({ control: form.control, name: 'decision' });

  const handleSubmit = form.handleSubmit((values) => {
    if (values.decision === 'APPROVE') {
      // Deliberately omit `rejectionReason` on the APPROVE path.
      onSubmit({ decision: 'APPROVE' });
    } else {
      onSubmit({
        decision: 'REJECT',
        rejectionReason: values.rejectionReason as string,
      });
    }
  });

  return (
    <Dialog open>
      <DialogContent data-testid="decision-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
            data-testid="decision-form"
          >
            <FormField
              control={form.control}
              name="decision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision</FormLabel>
                  <FormControl>
                    <div
                      role="radiogroup"
                      aria-label="Decision"
                      className="flex gap-4"
                    >
                      <label className="flex items-center gap-2 text-sm font-normal">
                        <input
                          type="radio"
                          name={field.name}
                          value="APPROVE"
                          checked={field.value === 'APPROVE'}
                          onChange={() => field.onChange('APPROVE')}
                          onBlur={field.onBlur}
                          data-testid="decision-approve"
                        />
                        <span>Approve</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm font-normal">
                        <input
                          type="radio"
                          name={field.name}
                          value="REJECT"
                          checked={field.value === 'REJECT'}
                          onChange={() => field.onChange('REJECT')}
                          onBlur={field.onBlur}
                          data-testid="decision-reject"
                        />
                        <span>Reject</span>
                      </label>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {decision === 'REJECT' ? (
              <FormField
                control={form.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why this batch is being rejected"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                        data-testid="rejection-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={pending}
                data-testid="decision-submit"
              >
                {pending ? 'Submitting…' : 'Submit decision'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form values: `decision` is always present; `rejectionReason` is
 * always a string (empty by default) so the underlying `<textarea>`
 * stays a controlled input even when the REJECT path is not active.
 * Conditional "required" validation lives in `superRefine` below.
 */
const decisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    rejectionReason: z.string(),
  })
  .superRefine((data, ctx) => {
    if (
      data.decision === 'REJECT' &&
      data.rejectionReason.trim().length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'A rejection reason is required when rejecting a batch.',
        path: ['rejectionReason'],
      });
    }
  });

type FormValues = z.infer<typeof decisionSchema>;
