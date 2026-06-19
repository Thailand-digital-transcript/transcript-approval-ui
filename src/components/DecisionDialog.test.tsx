import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionDialog } from './DecisionDialog';

describe('DecisionDialog', () => {
  it('does NOT call onSubmit when REJECT is selected with an empty reason', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DecisionDialog onSubmit={onSubmit} pending={false} />);

    // Switch to REJECT (default is APPROVE so the radio must be clicked).
    // `getByRole` avoids the ambiguity of `getByLabelText`, which would
    // also match the dialog's accessible name (its title is "Approve or
    // reject batch").
    await user.click(screen.getByRole('radio', { name: /^reject$/i }));

    // Submit with no reason
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // onSubmit must not be called
    expect(onSubmit).not.toHaveBeenCalled();

    // A validation error mentioning the reason must be visible
    expect(
      screen.getByText(/rejection reason is required/i),
    ).toBeInTheDocument();
  });

  it('calls onSubmit with {decision:"REJECT", rejectionReason} when both are provided', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DecisionDialog onSubmit={onSubmit} pending={false} />);

    await user.click(screen.getByRole('radio', { name: /^reject$/i }));
    await user.type(
      screen.getByLabelText(/rejection reason/i),
      'Document invalid',
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      decision: 'REJECT',
      rejectionReason: 'Document invalid',
    });
  });

  it('calls onSubmit with {decision:"APPROVE"} (no rejectionReason key) when APPROVE is selected', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DecisionDialog onSubmit={onSubmit} pending={false} />);

    // APPROVE is the default; click explicitly to be sure
    await user.click(screen.getByRole('radio', { name: /^approve$/i }));
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.decision).toBe('APPROVE');
    // The brief says "no rejectionReason" — the APPROVE payload should not
    // carry a rejectionReason field at all.
    expect('rejectionReason' in arg).toBe(false);
  });

  it('disables the submit button while pending is true', () => {
    const onSubmit = vi.fn();
    render(<DecisionDialog onSubmit={onSubmit} pending={true} />);

    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toBeDisabled();
  });

  it('does not call onSubmit when the disabled submit button is clicked while pending', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DecisionDialog onSubmit={onSubmit} pending={true} />);

    // userEvent respects the disabled state — clicking a disabled button
    // is a no-op. This guards against regressions where the button is
    // visually disabled but the form still submits.
    await user.click(screen.getByRole('radio', { name: /^reject$/i }));
    await user.type(
      screen.getByLabelText(/rejection reason/i),
      'Some reason',
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
