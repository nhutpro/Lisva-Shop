import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePasswordAction, loginAction, registerAction, saveAddressAction, updateProfileAction } from "@/app/[lang]/account/actions";
import vi_ from "@/i18n/dictionaries/vi.json";
import type { FormState } from "@/lib/auth/form-state";
import { AddressForm, LoginForm, PasswordForm, ProfileForm, RegisterForm } from "./forms";

vi.mock("@/app/[lang]/account/actions", () => ({
  loginAction: vi.fn(),
  registerAction: vi.fn(),
  updateProfileAction: vi.fn(),
  changePasswordAction: vi.fn(),
  saveAddressAction: vi.fn(),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const auth = vi_.auth;
const login = vi.mocked(loginAction);
const register = vi.mocked(registerAction);
const profile = vi.mocked(updateProfileAction);
const password = vi.mocked(changePasswordAction);
const saveAddress = vi.mocked(saveAddressAction);

const error = (code: string, fieldErrors?: Record<string, never> | Record<string, string>, values: Record<string, string> = {}, extra = {}): FormState =>
  ({ status: "error", error: { code, fieldErrors, ...extra }, values }) as FormState;

beforeEach(() => {
  for (const mock of [login, register, profile, password, saveAddress, replace]) mock.mockReset();
});

describe("LoginForm", () => {
  it("sends the email, password, language and where to go next", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ status: "idle" });
    render(<LoginForm locale="vi" auth={auth} next="/vi/checkout" />);

    await user.type(screen.getByLabelText(auth.login.email), "an@example.com");
    await user.type(screen.getByLabelText(auth.login.password), "mat-khau-1234");
    await user.click(screen.getByRole("button", { name: auth.login.submit }));

    const form = login.mock.calls[0][1];
    expect(form.get("email")).toBe("an@example.com");
    expect(form.get("password")).toBe("mat-khau-1234");
    expect(form.get("locale")).toBe("vi");
    expect(form.get("next")).toBe("/vi/checkout");
  });

  it("shows the same wrong-credentials message, keeps the email, and never gives the password back", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(error("INVALID_CREDENTIALS", undefined, { email: "an@example.com" }));
    render(<LoginForm locale="vi" auth={auth} />);

    await user.type(screen.getByLabelText(auth.login.email), "an@example.com");
    await user.type(screen.getByLabelText(auth.login.password), "wrong");
    await user.click(screen.getByRole("button", { name: auth.login.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(auth.formError.INVALID_CREDENTIALS);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(auth.login.email)).toHaveValue("an@example.com");
    expect(screen.getByLabelText(auth.login.password)).toHaveValue("");
  });

  it("tells a blocked client how long to wait", async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(error("RATE_LIMITED", undefined, {}, { retryAfterSeconds: 540 }));
    render(<LoginForm locale="vi" auth={auth} />);
    await user.click(screen.getByRole("button", { name: auth.login.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng thử lại sau 9 phút");
  });

  it("links to registration and keeps the next address; mentions that guests can still order", () => {
    render(<LoginForm locale="vi" auth={auth} next="/vi/checkout" />);
    expect(screen.getByRole("link", { name: auth.login.registerLink })).toHaveAttribute("href", `/vi/register?next=${encodeURIComponent("/vi/checkout")}`);
    expect(screen.getByText(auth.login.guestNote)).toBeInTheDocument();
  });

  it("disables the button while signing in", async () => {
    const user = userEvent.setup();
    let finish!: (s: FormState) => void;
    login.mockReturnValue(new Promise((r) => (finish = r)));
    render(<LoginForm locale="vi" auth={auth} />);
    await user.click(screen.getByRole("button", { name: auth.login.submit }));

    await waitFor(() => expect(screen.getByRole("button", { name: auth.login.submitting })).toBeDisabled());
    await act(async () => finish({ status: "idle" }));
  });
});

describe("RegisterForm", () => {
  it("shows each problem next to its field in Vietnamese and keeps what was typed", async () => {
    const user = userEvent.setup();
    register.mockResolvedValue(
      error("EMAIL_TAKEN", { email: "email_taken", password: "too_short", phone: "invalid_phone" }, { name: "Nguyễn An", email: "an@example.com", phone: "123" }),
    );
    render(<RegisterForm locale="vi" auth={auth} />);
    await user.click(screen.getByRole("button", { name: auth.register.submit }));

    expect(await screen.findByLabelText(auth.register.email)).toHaveAccessibleDescription(auth.fieldErrors.email_taken);
    expect(screen.getByLabelText(auth.register.password)).toHaveAccessibleDescription(auth.fieldErrors.too_short);
    expect(screen.getByLabelText(new RegExp(auth.register.phone))).toHaveAccessibleDescription(auth.fieldErrors.invalid_phone);
    expect(screen.getByLabelText(auth.register.name)).toHaveValue("Nguyễn An");
    expect(screen.getByLabelText(auth.register.email)).toHaveValue("an@example.com");
    expect(screen.getByLabelText(auth.register.password)).toHaveValue("");
    expect(screen.getByText(auth.register.passwordHint)).toBeInTheDocument();
  });

  it("marks the phone as optional and uses the right autocomplete hints", () => {
    render(<RegisterForm locale="vi" auth={auth} />);
    expect(screen.getByLabelText(new RegExp(auth.register.phone))).not.toBeRequired();
    expect(screen.getByLabelText(auth.register.password)).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText(auth.register.email)).toHaveAttribute("autocomplete", "email");
  });
});

describe("ProfileForm and PasswordForm", () => {
  const user = { email: "an@example.com", name: "Nguyễn An", phone: "0912345678" };

  it("shows the email as read-only and the current details", () => {
    render(<ProfileForm locale="vi" auth={auth} user={user} />);
    const email = screen.getByLabelText(auth.account.email);
    expect(email).toHaveValue("an@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByLabelText(auth.account.name)).toHaveValue("Nguyễn An");
    expect(screen.getByLabelText(auth.account.phone)).toHaveValue("0912345678");
  });

  it("confirms when the details were saved", async () => {
    const u = userEvent.setup();
    profile.mockResolvedValue({ status: "success", message: "profile_saved" });
    render(<ProfileForm locale="vi" auth={auth} user={user} />);
    await u.click(screen.getByRole("button", { name: auth.account.save }));
    expect(await screen.findByRole("status")).toHaveTextContent(auth.account.profile_saved);
  });

  it("explains a wrong current password and a mismatch next to the right fields", async () => {
    const u = userEvent.setup();
    password.mockResolvedValue(error("INVALID_INPUT", { currentPassword: "wrong_password", confirmPassword: "password_mismatch" }));
    render(<PasswordForm locale="vi" auth={auth} />);
    await u.click(screen.getByRole("button", { name: auth.account.passwordSubmit }));

    expect(await screen.findByLabelText(auth.account.currentPassword)).toHaveAccessibleDescription(auth.fieldErrors.wrong_password);
    expect(screen.getByLabelText(auth.account.confirmPassword)).toHaveAccessibleDescription(auth.fieldErrors.password_mismatch);
    expect(screen.getByLabelText(auth.account.newPassword)).toHaveAttribute("autocomplete", "new-password");
  });

  it("confirms a changed password", async () => {
    const u = userEvent.setup();
    password.mockResolvedValue({ status: "success", message: "password_changed" });
    render(<PasswordForm locale="vi" auth={auth} />);
    await u.click(screen.getByRole("button", { name: auth.account.passwordSubmit }));
    expect(await screen.findByRole("status")).toHaveTextContent(auth.account.password_changed);
  });
});

describe("AddressForm", () => {
  const blank = { recipientName: "Nguyễn An", phone: "0912345678", province: "", district: "", ward: "", street: "", isDefault: true };

  it("sends the id when editing, and the default flag", async () => {
    const u = userEvent.setup();
    saveAddress.mockResolvedValue({ status: "success", message: "address_saved" });
    render(<AddressForm locale="vi" auth={auth} address={{ ...blank, id: "addr-1", street: "12 Lê Lợi" }} cancelHref="/vi/account/addresses" />);
    await u.click(screen.getByRole("button", { name: auth.addresses.save }));

    const form = saveAddress.mock.calls[0][1];
    expect(form.get("addressId")).toBe("addr-1");
    expect(form.get("street")).toBe("12 Lê Lợi");
    expect(form.get("isDefault")).toBe("on");
    expect(await screen.findByRole("status")).toHaveTextContent(auth.addresses.address_saved);
  });

  it("closes the form (back to the refreshed list) once the address is saved, but stays open on errors", async () => {
    const u = userEvent.setup();
    saveAddress.mockResolvedValueOnce(error("INVALID_INPUT", { street: "required" }, {}));
    render(<AddressForm locale="vi" auth={auth} address={blank} cancelHref="/vi/account/addresses" />);
    await u.click(screen.getByRole("button", { name: auth.addresses.save }));
    await screen.findByRole("alert");
    expect(replace).not.toHaveBeenCalled();

    saveAddress.mockResolvedValueOnce({ status: "success", message: "address_saved" });
    await u.click(screen.getByRole("button", { name: auth.addresses.save }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/vi/account/addresses"));
  });

  it("shows field problems and the limit message, and offers a way out", async () => {
    const u = userEvent.setup();
    saveAddress.mockResolvedValue(error("INVALID_INPUT", { street: "required", phone: "invalid_phone" }, { recipientName: "An", phone: "1", street: "" }));
    render(<AddressForm locale="vi" auth={auth} address={blank} cancelHref="/vi/account/addresses" />);
    await u.click(screen.getByRole("button", { name: auth.addresses.save }));

    expect(await screen.findByLabelText(auth.addresses.street)).toHaveAccessibleDescription(auth.fieldErrors.required);
    expect(screen.getByLabelText(auth.addresses.phone)).toHaveAccessibleDescription(auth.fieldErrors.invalid_phone);
    expect(screen.getByRole("link", { name: auth.addresses.cancel })).toHaveAttribute("href", "/vi/account/addresses");
  });

  it("reports that the address limit was reached", async () => {
    const u = userEvent.setup();
    saveAddress.mockResolvedValue(error("LIMIT_REACHED", undefined, {}));
    render(<AddressForm locale="vi" auth={auth} address={blank} cancelHref="/x" />);
    await u.click(screen.getByRole("button", { name: auth.addresses.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(auth.formError.LIMIT_REACHED);
  });
});
